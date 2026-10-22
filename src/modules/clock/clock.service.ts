import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { addDays, startOfDay } from 'date-fns';
import { FilterQuery, Model, Types } from 'mongoose';
import { Account } from 'src/schemas/account';
import { WorkLog } from 'src/schemas/work-log';
import { UpdateWorkLogDto } from '../work-log/dto/updateWorkLog.dto';
import { WorkLogService } from '../work-log/work-log.service';
import { ClockCheckInDto } from './dto/clockCheckIn.dto';
import { ClockCheckOutDto } from './dto/clockCheckOut.dto';
import { ClockRecentLogsDto } from './dto/clockRecentLogs.dto';

@Injectable()
export class ClockService {
  constructor(
    @InjectModel(WorkLog.name) private workLogModel: Model<WorkLog>,
    private readonly workLogService: WorkLogService,
  ) {}

  private getTodayBounds() {
    const today = startOfDay(new Date());
    return { today, tomorrow: addDays(today, 1) };
  }

  async checkIn(account: Account, dto: ClockCheckInDto) {
    const { today, tomorrow } = this.getTodayBounds();

    const log = await this.workLogModel.findOne({
      account: account._id,
      organization: new Types.ObjectId(dto.organizationId),
      date: { $gte: today, $lt: tomorrow },
    });

    // First check-in of the day -> create a new work log
    if (!log) {
      return this.workLogService.create(account, {
        organizationId: dto.organizationId,
        checkIn: new Date().toISOString(),
        note: dto.note,
      });
    }

    // Subsequent check-in (OT / make-up) -> must close the previous session first
    const lastItem = log.items[log.items.length - 1];
    if (lastItem && !lastItem.checkOut) {
      throw new BadRequestException(
        'Please check out before checking in again',
      );
    }

    const items = log.items.map((i) => ({
      checkIn: i.checkIn.toISOString(),
      checkOut: i.checkOut ? i.checkOut.toISOString() : undefined,
    }));
    items.push({ checkIn: new Date().toISOString(), checkOut: undefined });

    const updatePayload: UpdateWorkLogDto = { items };
    if (dto.note !== undefined) updatePayload.note = dto.note;

    return this.workLogService.update(
      account,
      log._id.toString(),
      updatePayload,
    );
  }

  async checkOut(account: Account, dto: ClockCheckOutDto) {
    const { today, tomorrow } = this.getTodayBounds();

    const log = await this.workLogModel.findOne({
      account: account._id,
      organization: new Types.ObjectId(dto.organizationId),
      date: { $gte: today, $lt: tomorrow },
    });

    if (!log) {
      throw new NotFoundException(
        'No check-in found for today in this organization',
      );
    }

    let hoursLogItems = log.items.map((i) => ({
      checkIn: i.checkIn.toISOString(),
      checkOut: i.checkOut ? i.checkOut.toISOString() : undefined,
    }));
    const lastItem = hoursLogItems.pop();

    if (!lastItem) {
      throw new BadRequestException('No checkin was found');
    }
    if (lastItem.checkOut) {
      throw new BadRequestException('Already checked out today');
    }

    lastItem.checkOut = new Date().toISOString();
    hoursLogItems = [...hoursLogItems, lastItem];
    const updatePayload: UpdateWorkLogDto = {
      items: hoursLogItems,
    };
    if (dto.note !== undefined) updatePayload.note = dto.note;

    return this.workLogService.update(
      account,
      log._id.toString(),
      updatePayload,
    );
  }

  async today(account: Account, organizationId?: string) {
    const { today, tomorrow } = this.getTodayBounds();

    const filter: FilterQuery<WorkLog> = {
      account: account._id,
      date: { $gte: today, $lt: tomorrow },
    };
    if (organizationId) {
      filter.organization = new Types.ObjectId(organizationId);
    }

    const log = await this.workLogModel
      .findOne(filter)
      .populate('organization', '_id name')
      .lean();

    return {
      date: today,
      checkedIn: log?.items?.length > 0,
      checkedOut: log?.items?.some((i) => !!i.checkOut),
      log: log ?? null,
    };
  }

  async recentLogs(account: Account, dto: ClockRecentLogsDto) {
    const limit = dto.limit ?? 7;
    const filter: FilterQuery<WorkLog> = { account: account._id };
    if (dto.organizationId) {
      filter.organization = new Types.ObjectId(dto.organizationId);
    }

    return this.workLogModel
      .find(filter)
      .populate('organization', '_id name')
      .sort({ date: -1 })
      .limit(limit)
      .lean();
  }
}
