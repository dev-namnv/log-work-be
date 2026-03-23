import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { Account } from 'src/schemas/account';
import { CreateWorkLogDto } from './dto/createWorkLog.dto';
import { MonthlyReportDto } from './dto/monthlyReport.dto';
import { SearchWorkLogDto } from './dto/searchWorkLog.dto';
import { UpdateWorkLogDto } from './dto/updateWorkLog.dto';
import { WorkLogByOrganizationDto } from './dto/workLogByOrganization.dto';
import { WorkLogService } from './work-log.service';

@SkipCache()
@Auth()
@Controller('work-log')
export class WorkLogController {
  constructor(private readonly workLogService: WorkLogService) {}

  @ApiTags('WorkLog')
  @ApiOperation({ summary: 'Create a work log entry' })
  @Post()
  async create(
    @CurrentAccount() account: Account,
    @Body() dto: CreateWorkLogDto,
  ) {
    return this.workLogService.create(account, dto);
  }

  @ApiTags('WorkLog')
  @ApiOperation({ summary: 'Search work logs of current user' })
  @Post('/search')
  async search(
    @CurrentAccount() account: Account,
    @Body() dto: SearchWorkLogDto,
  ) {
    return this.workLogService.search(account, dto);
  }

  @ApiTags('WorkLog')
  @ApiOperation({
    summary: 'Monthly report for current user',
    description:
      'Returns totalHours, standardWorkDays (excluding Sat/Sun), loggedDays and all log entries for the given month/year. Optionally filter by organizationId.',
  })
  @Get('/monthly-report')
  async monthlyReport(
    @CurrentAccount() account: Account,
    @Query() dto: MonthlyReportDto,
  ) {
    return this.workLogService.monthlyReport(account, dto);
  }

  @ApiTags('WorkLog')
  @ApiOperation({
    summary: 'Analytics by organization',
    description:
      'Returns per-member work log summary (totalHours, loggedDays, logs) for a given organization, month and year.',
  })
  @Post('/by-organization')
  async byOrganization(
    @CurrentAccount() account: Account,
    @Body() dto: WorkLogByOrganizationDto,
  ) {
    return this.workLogService.byOrganization(account, dto);
  }

  @ApiTags('WorkLog')
  @ApiOperation({ summary: 'Get work log detail' })
  @Get(':id/detail')
  async detail(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
  ) {
    return this.workLogService.detail(account, params.id);
  }

  @ApiTags('WorkLog')
  @ApiOperation({ summary: 'Update a work log entry' })
  @Patch(':id')
  async update(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
    @Body() dto: UpdateWorkLogDto,
  ) {
    return this.workLogService.update(account, params.id, dto);
  }

  @ApiTags('WorkLog')
  @ApiOperation({ summary: 'Delete a work log entry' })
  @Delete(':id/delete')
  async remove(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
  ) {
    return this.workLogService.remove(account, params.id);
  }
}
