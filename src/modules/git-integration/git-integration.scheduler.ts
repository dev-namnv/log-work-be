import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GitIntegrationService } from './git-integration.service';

@Injectable()
export class GitIntegrationScheduler {
  constructor(private readonly gitIntegrationService: GitIntegrationService) {}

  /** Runs every 10 minutes: poll all active git integrations for new commits. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollAllIntegrations(): Promise<void> {
    await this.gitIntegrationService.pollAllIntegrations();
  }
}
