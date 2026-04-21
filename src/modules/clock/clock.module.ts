import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkLog, WorkLogSchema } from 'src/schemas/work-log';
import { WorkLogModule } from '../work-log/work-log.module';
import { ClockController } from './clock.controller';
import { ClockService } from './clock.service';

@Module({
  imports: [
    WorkLogModule,
    MongooseModule.forFeature([{ name: WorkLog.name, schema: WorkLogSchema }]),
  ],
  controllers: [ClockController],
  providers: [ClockService],
})
export class ClockModule {}
