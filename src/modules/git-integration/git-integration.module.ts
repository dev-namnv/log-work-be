import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import {
  GitIntegration,
  GitIntegrationSchema,
} from 'src/schemas/git-integration';
import { Organization, OrganizationSchema } from 'src/schemas/organization';
import { WorkLog, WorkLogSchema } from 'src/schemas/work-log';
import { UserRefModule } from '../user-ref/user-ref.module';
import { GitIntegrationController } from './git-integration.controller';
import { GitIntegrationScheduler } from './git-integration.scheduler';
import { GitIntegrationService } from './git-integration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GitIntegration.name, schema: GitIntegrationSchema },
      { name: WorkLog.name, schema: WorkLogSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    JwtModule.register({}),
    UserRefModule,
  ],
  controllers: [GitIntegrationController],
  providers: [GitIntegrationService, GitIntegrationScheduler],
  exports: [GitIntegrationService],
})
export class GitIntegrationModule {}
