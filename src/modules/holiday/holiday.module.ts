import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Holiday, HolidaySchema } from 'src/schemas/holiday';
import { HolidayController } from './holiday.controller';
import { HolidayService } from './holiday.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Holiday.name, schema: HolidaySchema },
    ]),
  ],
  controllers: [HolidayController],
  providers: [HolidayService],
  exports: [HolidayService],
})
export class HolidayModule {}
