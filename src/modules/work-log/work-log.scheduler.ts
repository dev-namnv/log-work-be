import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkLogService } from './work-log.service';

@Injectable()
export class WorkLogScheduler {
  constructor(private readonly workLogService: WorkLogService) {}

  /** Runs daily at 01:00: auto-checkout work logs left open the previous day. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async autoCheckoutMissed(): Promise<void> {
    await this.workLogService.autoCheckoutMissed();
  }
}
