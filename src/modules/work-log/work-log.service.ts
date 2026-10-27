import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { FilterQuery, Model, Types } from 'mongoose';
import { Account } from 'src/schemas/account';
import { HolidayType } from 'src/schemas/holiday';
import {
  DEFAULT_WORK_SCHEDULE,
  Organization,
  WorkSchedule,
} from 'src/schemas/organization';
import { HoursLogItem, WorkLog } from 'src/schemas/work-log';
import { WorkLogShare } from 'src/schemas/work-log-share';
import PaginationUtil, { PaginationResponse } from 'src/utils/pagination.util';
import { HolidayService } from '../holiday/holiday.service';
import { UserRefService } from '../user-ref/user-ref.service';
import { CreateShareLinkDto } from './dto/createShareLink.dto';
import { CreateWorkLogDto } from './dto/createWorkLog.dto';
import { MonthlyReportDto } from './dto/monthlyReport.dto';
import { SearchWorkLogDto } from './dto/searchWorkLog.dto';
import { UpdateWorkLogDto } from './dto/updateWorkLog.dto';
import { WorkLogByOrganizationDto } from './dto/workLogByOrganization.dto';

@Injectable()
export class WorkLogService {
  private readonly logger = new Logger(WorkLogService.name);

  constructor(
    @InjectModel(WorkLog.name) private workLogModel: Model<WorkLog>,
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
    @InjectModel(WorkLogShare.name)
    private workLogShareModel: Model<WorkLogShare>,
    private userRefService: UserRefService,
    private holidayService: HolidayService,
  ) {}

  // Ngày công chuẩn: T2–T6 trừ lễ (Off), cộng ngày làm bù cuối tuần (Workday).
  private async getStandardWorkingDays(
    year: number,
    month: number,
  ): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const holidays = await this.holidayService.findByMonth(year, month);
    const off = new Set(
      holidays.filter((h) => h.type === HolidayType.OFF).map((h) => h.date),
    );
    const workday = new Set(
      holidays.filter((h) => h.type === HolidayType.WORKDAY).map((h) => h.date),
    );
    return eachDayOfInterval({ start, end }).filter((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const isWeekend = getDay(day) === 0 || getDay(day) === 6;
      return isWeekend ? workday.has(key) : !off.has(key);
    }).length;
  }

  /**
   * Compute net standard hours per workday from org schedule.
   * e.g. 08:00–17:30 minus 60 min lunch = 8.5 h/day
   */
  private getStandardHoursPerDay(schedule: WorkSchedule): number {
    const [startH, startM] = schedule.workStartTime.split(':').map(Number);
    const [endH, endM] = schedule.workEndTime.split(':').map(Number);
    const totalMinutes =
      endH * 60 + endM - (startH * 60 + startM) - schedule.lunchBreakMinutes;
    return Math.round((totalMinutes / 60) * 100) / 100;
  }

  /**
   * Any work log from the previous day left without a checkOut is
   * auto-checked-out so the day reaches the organization's standard hours.
   * checkOut = checkIn + (standardHoursPerDay + lunch break) so the stored net
   * `hours` equals the org's standardHoursPerDay. Called by WorkLogScheduler.
   */
  async autoCheckoutMissed(): Promise<void> {
    const start = startOfDay(addDays(new Date(), -1));
    const end = startOfDay(new Date());

    const logs = await this.workLogModel.find({
      'items.checkOut': null,
      date: { $gte: start, $lt: end },
    });
    if (!logs.length) return;

    this.logger.debug(`Auto-checkout ${logs.length} missed work log(s)`);

    for (const log of logs) {
      try {
        const org = await this.organizationModel.findById(log.organization);
        const schedule = org?.workSchedule ?? DEFAULT_WORK_SCHEDULE;
        const standardHours = this.getStandardHoursPerDay(schedule);
        const rawMinutes =
          standardHours * 60 +
          (log.skipLunchBreak ? 0 : schedule.lunchBreakMinutes);
        const lastItem = log.items[log.items.length - 1];
        lastItem.checkOut = addMinutes(lastItem.checkIn, rawMinutes);
        log.hours = this.getWorkedHoursByDay({
          items: log.items,
          breakMinutes: schedule.lunchBreakMinutes,
          skipLunchBreak: log.skipLunchBreak,
        });
        await log.save();
      } catch (err) {
        this.logger.error(
          `Auto-checkout failed for log=${log._id}: ${(err as Error)?.message}`,
        );
      }
    }
  }

  async create(account: Account, dto: CreateWorkLogDto): Promise<WorkLog> {
    const org = await this.organizationModel.findById(dto.organizationId);
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.members.some((m) => m.toString() === account._id.toString())) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const checkIn = new Date(dto.checkIn);
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : null;

    // Validate that checkIn is not in the future
    if (checkIn > addDays(startOfDay(new Date()), 1)) {
      throw new BadRequestException('Check-in cannot be in the future');
    }
    // Validate that checkIn and checkOut are on the same day (if checkOut is provided)
    if (checkOut) {
      const checkInDay = startOfDay(checkIn).getTime();
      const checkOutDay = startOfDay(checkOut).getTime();
      if (checkInDay !== checkOutDay) {
        throw new BadRequestException(
          'Check-in and check-out must be on the same day',
        );
      }
    }
    // If checkOut is provided, it must be after checkIn
    if (checkOut && checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after Check-in');
    }

    const dayStart = new Date(
      checkIn.getFullYear(),
      checkIn.getMonth(),
      checkIn.getDate(),
    );
    const dayEnd = new Date(
      checkIn.getFullYear(),
      checkIn.getMonth(),
      checkIn.getDate() + 1,
    );

    const existing = await this.workLogModel.findOne({
      account: account._id,
      organization: new Types.ObjectId(dto.organizationId),
      date: { $gte: dayStart, $lt: dayEnd },
    });
    if (existing) {
      throw new BadRequestException(
        'A work log for this date and organization already exists',
      );
    }

    const items = [{ checkIn, checkOut }];
    const hours = this.getWorkedHoursByDay({
      items,
      breakMinutes: org.workSchedule.lunchBreakMinutes,
      skipLunchBreak: dto.skipLunchBreak ?? false,
    });

    return this.workLogModel
      .create({
        account: account._id,
        organization: new Types.ObjectId(dto.organizationId),
        date: dayStart,
        items,
        hours,
        note: dto.note ?? null,
        skipLunchBreak: dto.skipLunchBreak ?? false,
      })
      .then((log) => {
        void this.userRefService.setLastWorkLogOrganization(
          account._id,
          dto.organizationId,
        );
        return log;
      });
  }

  async search(
    account: Account,
    dto: SearchWorkLogDto,
  ): Promise<PaginationResponse<WorkLog>> {
    const filterQuery: FilterQuery<WorkLog> = { account: account._id };
    if (dto.organizationId) {
      filterQuery.organization = new Types.ObjectId(dto.organizationId);
    }
    if (dto.date) {
      filterQuery.date = startOfDay(new Date(dto.date));
    }
    if (dto.month && dto.year) {
      const start = startOfMonth(new Date(dto.year, dto.month - 1));
      const end = endOfMonth(start);
      filterQuery.date = { $gte: start, $lte: end };
    }

    const { keyword, page, limit, match, skip, sort } =
      PaginationUtil.getQueryByPagination(dto, filterQuery);

    const data = await this.workLogModel
      .aggregate()
      .match({ ...match, ...(keyword ? { $text: { $search: keyword } } : {}) })
      .lookup({
        from: 'organizations',
        localField: 'organization',
        foreignField: '_id',
        as: 'organization',
        pipeline: [{ $project: { _id: 1, name: 1 } }],
      })
      .unwind({ path: '$organization', preserveNullAndEmptyArrays: true })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await this.workLogModel.countDocuments(
      keyword ? { $text: { $search: keyword } } : match,
    );

    return PaginationUtil.getPaginationResponse({ data, limit, page, total });
  }

  async detail(account: Account, id: string): Promise<WorkLog> {
    const log = await this.workLogModel
      .findById(id)
      .populate('organization', '_id name')
      .lean();
    if (!log) throw new NotFoundException('Work log not found');
    if (log.account.toString() !== account._id.toString()) {
      throw new ForbiddenException('Access denied');
    }
    return log as unknown as WorkLog;
  }

  async update(account: Account, id: string, dto: UpdateWorkLogDto) {
    const log = await this.workLogModel.findById(id);
    if (!log) throw new NotFoundException('Work log not found');
    if (log.account.toString() !== account._id.toString()) {
      throw new ForbiddenException('Access denied');
    }
    const organization = await this.organizationModel.findById(
      log.organization,
    );
    if (!organization) throw new NotFoundException('Organization not found');

    const items = dto.items
      ? dto.items.map((i) => ({
          checkIn: new Date(i.checkIn),
          checkOut: i.checkOut ? new Date(i.checkOut) : null,
        }))
      : log.items;

    // If any item's checkout is after checkin
    if (items.some((i) => i.checkOut && i.checkOut <= i.checkIn)) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const skipLunchBreak =
      dto.skipLunchBreak !== undefined
        ? dto.skipLunchBreak
        : log.skipLunchBreak;

    const hours = this.getWorkedHoursByDay({
      items,
      breakMinutes: organization.workSchedule.lunchBreakMinutes,
      skipLunchBreak,
    });

    const updatePayload: Partial<WorkLog> = {
      hours,
      items,
      skipLunchBreak,
    };
    if (dto.note !== undefined) updatePayload.note = dto.note;

    await this.workLogModel.findByIdAndUpdate(id, updatePayload, { new: true });
    return { message: 'Work log updated' };
  }

  async remove(account: Account, id: string) {
    const log = await this.workLogModel.findById(id);
    if (!log) throw new NotFoundException('Work log not found');
    if (log.account.toString() !== account._id.toString()) {
      throw new ForbiddenException('Access denied');
    }
    await log.deleteOne();
    return { message: 'Work log deleted' };
  }

  /**
   * One-off migration: convert legacy work logs that stored a single
   * `checkIn`/`checkOut` pair into the new `items` array, then drop the old
   * fields. Idempotent - only touches docs that still lack `items`.
   */
  async migrateToItems(): Promise<{ migrated: number }> {
    const res = await this.workLogModel.updateMany(
      { items: { $exists: false } },
      [
        {
          $set: {
            items: [{ checkIn: '$checkIn', checkOut: '$checkOut' }],
          },
        },
        { $unset: ['checkIn', 'checkOut'] },
      ],
    );
    this.logger.log(
      `Migrated ${res.modifiedCount} legacy work log(s) to items`,
    );
    return { migrated: res.modifiedCount };
  }

  async monthlyReport(account: Account, dto: MonthlyReportDto) {
    const { month, year, organizationId } = dto;
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);

    const filter: FilterQuery<WorkLog> = {
      account: account._id,
      date: { $gte: start, $lte: end },
    };
    if (organizationId) {
      filter.organization = new Types.ObjectId(organizationId);
    }

    const logs = await this.workLogModel
      .find(filter)
      .populate('organization', '_id name workSchedule')
      .sort({ date: 1 })
      .lean();

    const totalHours =
      Math.round(logs.reduce((sum, l) => sum + l.hours, 0) * 100) / 100;
    const standardWorkDays = await this.getStandardWorkingDays(year, month);

    // Resolve schedule: prefer org schedule, fall back to default
    let schedule = DEFAULT_WORK_SCHEDULE;
    if (organizationId && logs.length > 0) {
      const orgDoc = logs[0].organization as any;
      if (orgDoc?.workSchedule) schedule = orgDoc.workSchedule;
    } else if (!organizationId && organizationId === undefined) {
      const org = await this.organizationModel
        .findOne({
          $or: [{ owner: account._id }, { members: account._id }],
          isActive: true,
        })
        .lean();
      if (org?.workSchedule) schedule = org.workSchedule;
    }

    const standardHoursPerDay = this.getStandardHoursPerDay(schedule);
    const totalStandardHours =
      Math.round(standardHoursPerDay * standardWorkDays * 100) / 100;
    const overtimeHours = Math.max(
      0,
      Math.round((totalHours - totalStandardHours) * 100) / 100,
    );
    const missingHours = Math.max(
      0,
      Math.round((totalStandardHours - totalHours) * 100) / 100,
    );
    const attendanceRate =
      totalStandardHours > 0
        ? Math.round((totalHours / totalStandardHours) * 10000) / 100
        : 0;

    return {
      month,
      year,
      organizationId: organizationId ?? null,
      workSchedule: schedule,
      standardHoursPerDay,
      standardWorkDays,
      totalStandardHours,
      totalHours,
      loggedDays: logs.length,
      overtimeHours,
      missingHours,
      attendanceRate,
      logs,
    };
  }

  async byOrganization(account: Account, dto: WorkLogByOrganizationDto) {
    const { organizationId, month, year } = dto;

    const org = await this.organizationModel
      .findById(organizationId)
      .populate('members', '_id firstName lastName email avatar')
      .lean();
    if (!org) throw new NotFoundException('Organization not found');

    const isMember = (org.members as any[]).some(
      (m) => m._id.toString() === account._id.toString(),
    );
    if (!isMember && org.owner.toString() !== account._id.toString()) {
      throw new ForbiddenException('Access denied');
    }

    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);

    const logs = await this.workLogModel
      .find({
        organization: new Types.ObjectId(organizationId),
        date: { $gte: start, $lte: end },
      })
      .lean();

    const standardWorkDays = await this.getStandardWorkingDays(year, month);
    const schedule: WorkSchedule = org.workSchedule ?? DEFAULT_WORK_SCHEDULE;
    const standardHoursPerDay = this.getStandardHoursPerDay(schedule);
    const totalStandardHours =
      Math.round(standardHoursPerDay * standardWorkDays * 100) / 100;

    const memberReports = (org.members as any[]).map((member) => {
      const memberLogs = logs
        .filter((l) => l.account.toString() === member._id.toString())
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

      const totalHours =
        Math.round(memberLogs.reduce((sum, l) => sum + l.hours, 0) * 100) / 100;
      const overtimeHours = Math.max(
        0,
        Math.round((totalHours - totalStandardHours) * 100) / 100,
      );
      const missingHours = Math.max(
        0,
        Math.round((totalStandardHours - totalHours) * 100) / 100,
      );
      const attendanceRate =
        totalStandardHours > 0
          ? Math.round((totalHours / totalStandardHours) * 10000) / 100
          : 0;

      return {
        account: member,
        totalHours,
        loggedDays: memberLogs.length,
        overtimeHours,
        missingHours,
        attendanceRate,
        logs: memberLogs,
      };
    });

    return {
      organization: {
        _id: org._id,
        name: org.name,
        workSchedule: schedule,
      },
      month,
      year,
      standardHoursPerDay,
      standardWorkDays,
      totalStandardHours,
      members: memberReports,
    };
  }

  private getWorkedHoursByDay(params: {
    items: HoursLogItem[];
    breakMinutes: number;
    skipLunchBreak?: boolean;
  }): number {
    const { items, skipLunchBreak } = params;
    if (!items.length) return 0;
    const rawHours = items.reduce((accumulator, currentValue) => {
      // Skip open items (no checkOut) so differenceInMinutes never yields NaN
      if (!currentValue?.checkOut || !currentValue.checkIn) return accumulator;
      return (
        accumulator +
        Math.round(
          (differenceInMinutes(currentValue.checkOut, currentValue.checkIn) /
            60) *
            100,
        ) /
          100
      );
    }, 0);
    // No closed session yet -> no worked hours, and don't deduct lunch (would go negative)
    if (rawHours <= 0) return 0;
    if (skipLunchBreak) return rawHours;
    const net = Math.round((rawHours - params.breakMinutes / 60) * 100) / 100;
    return Math.max(0, net);
  }

  // ─────────────────────── Share Link ───────────────────────

  async createShareLink(account: Account, dto: CreateShareLinkDto) {
    const { month, year, organizationId, label, expiresAt } = dto;

    if (organizationId) {
      const org = await this.organizationModel.findById(organizationId);
      if (!org) throw new NotFoundException('Organization not found');
      const isMember =
        org.members.some((m) => m.toString() === account._id.toString()) ||
        org.owner.toString() === account._id.toString();
      if (!isMember)
        throw new ForbiddenException(
          'You are not a member of this organization',
        );
    }

    const token = randomBytes(24).toString('hex');
    const share = await this.workLogShareModel.create({
      token,
      account: account._id,
      organization: organizationId ? new Types.ObjectId(organizationId) : null,
      month,
      year,
      label:
        label ??
        `Báo cáo tháng ${String(month).padStart(2, '0')}/${year} — ${account.firstName} ${account.lastName}`.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    });

    return share;
  }

  async listShareLinks(account: Account) {
    return this.workLogShareModel
      .find({ account: account._id })
      .populate('organization', '_id name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async revokeShareLink(account: Account, id: string) {
    const share = await this.workLogShareModel.findById(id);
    if (!share) throw new NotFoundException('Share link not found');
    if (share.account.toString() !== account._id.toString()) {
      throw new ForbiddenException('Access denied');
    }
    await share.deleteOne();
    return { message: 'Share link revoked' };
  }

  async viewSharedReport(token: string) {
    const share = await this.workLogShareModel
      .findOne({ token })
      .populate('account', '_id firstName lastName email avatar')
      .populate('organization', '_id name workSchedule')
      .lean();

    if (!share) throw new NotFoundException('Share link not found');
    if (!share.isActive)
      throw new GoneException('Share link is no longer active');
    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new GoneException('Share link has expired');
    }

    const accountId = (share.account as any)._id;
    const { month, year } = share;
    const organizationId = share.organization
      ? (share.organization as any)._id.toString()
      : undefined;

    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);

    const filter: FilterQuery<WorkLog> = {
      account: accountId,
      date: { $gte: start, $lte: end },
    };
    if (organizationId) {
      filter.organization = new Types.ObjectId(organizationId);
    }

    const logs = await this.workLogModel
      .find(filter)
      .populate('organization', '_id name workSchedule')
      .sort({ date: 1 })
      .lean();

    const totalHours =
      Math.round(logs.reduce((sum, l) => sum + l.hours, 0) * 100) / 100;
    const standardWorkDays = await this.getStandardWorkingDays(year, month);

    let schedule = DEFAULT_WORK_SCHEDULE;
    if (organizationId) {
      const orgDoc = share.organization as any;
      if (orgDoc?.workSchedule) schedule = orgDoc.workSchedule;
    } else {
      const org = await this.organizationModel
        .findOne({
          $or: [{ owner: accountId }, { members: accountId }],
          isActive: true,
        })
        .lean();
      if (org?.workSchedule) schedule = org.workSchedule;
    }

    const standardHoursPerDay = this.getStandardHoursPerDay(schedule);
    const totalStandardHours =
      Math.round(standardHoursPerDay * standardWorkDays * 100) / 100;
    const overtimeHours = Math.max(
      0,
      Math.round((totalHours - totalStandardHours) * 100) / 100,
    );
    const missingHours = Math.max(
      0,
      Math.round((totalStandardHours - totalHours) * 100) / 100,
    );
    const attendanceRate =
      totalStandardHours > 0
        ? Math.round((totalHours / totalStandardHours) * 10000) / 100
        : 0;

    return {
      share: {
        _id: share._id,
        token: share.token,
        label: share.label,
        month: share.month,
        year: share.year,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
      },
      account: share.account,
      organization: share.organization ?? null,
      month,
      year,
      workSchedule: schedule,
      standardHoursPerDay,
      standardWorkDays,
      totalStandardHours,
      totalHours,
      loggedDays: logs.length,
      overtimeHours,
      missingHours,
      attendanceRate,
      logs,
    };
  }
}
