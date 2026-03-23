import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Organization, OrganizationSchema } from 'src/schemas/organization';
import { WorkLog, WorkLogSchema } from 'src/schemas/work-log';
import { WorkLogController } from './work-log.controller';
import { WorkLogService } from './work-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkLog.name, schema: WorkLogSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  controllers: [WorkLogController],
  providers: [WorkLogService],
  exports: [WorkLogService],
})
export class WorkLogModule {}
