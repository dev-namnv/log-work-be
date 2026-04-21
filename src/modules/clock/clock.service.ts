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

  async checkIn(account: Account, dto: ClockCheckInDto): Promise<WorkLog> {
    return this.workLogService.create(account, {
      organizationId: dto.organizationId,
      checkIn: new Date().toISOString(),
      note: dto.note,
    });
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

    if (log.checkOut) {
      throw new BadRequestException('Already checked out today');
    }

    const updatePayload: Record<string, any> = {
      checkOut: new Date().toISOString(),
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
      checkedIn: !!log,
      checkedOut: !!log?.checkOut,
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
