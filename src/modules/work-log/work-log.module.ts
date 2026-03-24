import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Organization, OrganizationSchema } from 'src/schemas/organization';
import { WorkLog, WorkLogSchema } from 'src/schemas/work-log';
import { WorkLogShare, WorkLogShareSchema } from 'src/schemas/work-log-share';
import { WorkLogShareController } from './work-log-share.controller';
import { WorkLogController } from './work-log.controller';
import { WorkLogService } from './work-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkLog.name, schema: WorkLogSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: WorkLogShare.name, schema: WorkLogShareSchema },
    ]),
  ],
  controllers: [WorkLogController, WorkLogShareController],
  providers: [WorkLogService],
  exports: [WorkLogService],
})
export class WorkLogModule {}
