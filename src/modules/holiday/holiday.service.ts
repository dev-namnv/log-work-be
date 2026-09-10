import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Holiday } from 'src/schemas/holiday';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidayService {
  constructor(
    @InjectModel(Holiday.name) private holidayModel: Model<Holiday>,
  ) {}

  list(year?: string) {
    const filter: FilterQuery<Holiday> = {};
    if (year) filter.date = { $regex: `^${year}-` };
    return this.holidayModel.find(filter).sort({ date: 1 }).lean();
  }

  async create(dto: CreateHolidayDto) {
    const exists = await this.holidayModel.exists({ date: dto.date });
    if (exists)
      throw new ConflictException(`Holiday ${dto.date} already exists`);
    return this.holidayModel.create(dto);
  }

  async update(id: string, dto: UpdateHolidayDto) {
    if (dto.date) {
      const clash = await this.holidayModel.exists({
        date: dto.date,
        _id: { $ne: new Types.ObjectId(id) },
      });
      if (clash)
        throw new ConflictException(`Holiday ${dto.date} already exists`);
    }
    const updated = await this.holidayModel
      .findByIdAndUpdate(new Types.ObjectId(id), dto, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Holiday not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.holidayModel
      .findByIdAndDelete(new Types.ObjectId(id))
      .lean();
    if (!deleted) throw new NotFoundException('Holiday not found');
    return { deleted: true };
  }
}
