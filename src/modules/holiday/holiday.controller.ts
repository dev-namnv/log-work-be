import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { AccountRole } from 'src/interfaces/Account';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { QueryHolidayDto } from './dto/query-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidayService } from './holiday.service';

@ApiTags('Holiday')
@Controller('holidays')
export class HolidayController {
  constructor(private holidayService: HolidayService) {}

  @ApiOperation({ summary: 'List holidays (public), optional ?year=YYYY' })
  @Get()
  list(@Query() query: QueryHolidayDto) {
    return this.holidayService.list(query.year);
  }

  @ApiOperation({ summary: 'Create a holiday (admin)' })
  @Auth(AccountRole.ADMIN)
  @Post()
  create(@Body() dto: CreateHolidayDto) {
    return this.holidayService.create(dto);
  }

  @ApiOperation({ summary: 'Update a holiday (admin)' })
  @Auth(AccountRole.ADMIN)
  @Put(':id')
  update(@Param() { id }: MongoIdDto, @Body() dto: UpdateHolidayDto) {
    return this.holidayService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a holiday (admin)' })
  @Auth(AccountRole.ADMIN)
  @Delete(':id')
  remove(@Param() { id }: MongoIdDto) {
    return this.holidayService.remove(id);
  }
}
