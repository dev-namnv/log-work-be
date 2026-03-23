import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  getDay,
  startOfMonth,
} from 'date-fns';
import { FilterQuery, Model, Types } from 'mongoose';
import { Account } from 'src/schemas/account';
import {
  DEFAULT_WORK_SCHEDULE,
  Organization,
  WorkSchedule,
} from 'src/schemas/organization';
import { WorkLog } from 'src/schemas/work-log';
import PaginationUtil, { PaginationResponse } from 'src/utils/pagination.util';
import { CreateWorkLogDto } from './dto/createWorkLog.dto';
import { MonthlyReportDto } from './dto/monthlyReport.dto';
import { SearchWorkLogDto } from './dto/searchWorkLog.dto';
import { UpdateWorkLogDto } from './dto/updateWorkLog.dto';
import { WorkLogByOrganizationDto } from './dto/workLogByOrganization.dto';

@Injectable()
export class WorkLogService {
  constructor(
    @InjectModel(WorkLog.name) private workLogModel: Model<WorkLog>,
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
  ) {}

  private getStandardWorkingDays(year: number, month: number): number {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end }).filter(
      (day) => getDay(day) !== 0 && getDay(day) !== 6,
    ).length;
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

  async create(account: Account, dto: CreateWorkLogDto): Promise<WorkLog> {
    const org = await this.organizationModel.findById(dto.organizationId);
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.members.some((m) => m.toString() === account._id.toString())) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
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

    const hours =
      Math.round((differenceInMinutes(checkOut, checkIn) / 60) * 100) / 100;

    return this.workLogModel.create({
      account: account._id,
      organization: new Types.ObjectId(dto.organizationId),
      date: dayStart,
      checkIn,
      checkOut,
      hours,
      note: dto.note ?? null,
    });
  }

  async search(
    account: Account,
    dto: SearchWorkLogDto,
  ): Promise<PaginationResponse<WorkLog>> {
    const filterQuery: FilterQuery<WorkLog> = { account: account._id };
    const { keyword, page, limit, match, skip, sort } =
      PaginationUtil.getQueryByPagination(dto, filterQuery);

    const data = await this.workLogModel
      .aggregate()
      .match(keyword ? { $text: { $search: keyword } } : match)
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

    const checkIn = dto.checkIn ? new Date(dto.checkIn) : log.checkIn;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : log.checkOut;

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const hours =
      Math.round((differenceInMinutes(checkOut, checkIn) / 60) * 100) / 100;

    const updatePayload: Partial<WorkLog> = { hours, checkIn, checkOut };
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
    const standardWorkDays = this.getStandardWorkingDays(year, month);

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

    const standardWorkDays = this.getStandardWorkingDays(year, month);
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
}
