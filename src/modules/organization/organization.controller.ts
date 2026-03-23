import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { Account } from 'src/schemas/account';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { MemberDto } from './dto/member.dto';
import { SearchOrganizationDto } from './dto/searchOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { UpdateWorkScheduleDto } from './dto/workSchedule.dto';
import { OrganizationService } from './organization.service';

@SkipCache()
@Auth()
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @ApiTags('Organization')
  @ApiOperation({ summary: 'Create an organization' })
  @Post()
  async create(
    @CurrentAccount() account: Account,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationService.create(account, dto);
  }

  @ApiTags('Organization')
  @ApiOperation({
    summary: 'Search organizations (where user is owner or member)',
  })
  @Post('/search')
  async search(
    @CurrentAccount() account: Account,
    @Body() dto: SearchOrganizationDto,
  ) {
    return this.organizationService.search(account, dto);
  }

  @ApiTags('Organization')
  @ApiOperation({ summary: 'Get organization detail' })
  @Get(':id/detail')
  async detail(@Param() params: MongoIdDto) {
    return this.organizationService.detail(params.id);
  }

  @ApiTags('Organization')
  @ApiOperation({ summary: 'Update an organization (owner only)' })
  @Patch(':id')
  async update(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(account, params.id, dto);
  }

  @ApiTags('Organization')
  @ApiOperation({ summary: 'Delete an organization (owner only)' })
  @Delete(':id/delete')
  async remove(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
  ) {
    return this.organizationService.remove(account, params.id);
  }

  @ApiTags('Organization')
  @ApiOperation({ summary: 'Add a member to organization (owner only)' })
  @Post(':id/add-member')
  async addMember(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
    @Body() dto: MemberDto,
  ) {
    return this.organizationService.addMember(account, params.id, dto.memberId);
  }

  @ApiTags('Organization')
  @ApiOperation({ summary: 'Remove a member from organization (owner only)' })
  @Post(':id/remove-member')
  async removeMember(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
    @Body() dto: MemberDto,
  ) {
    return this.organizationService.removeMember(
      account,
      params.id,
      dto.memberId,
    );
  }

  @ApiTags('Organization')
  @ApiOperation({
    summary: 'Update work schedule (owner only)',
    description:
      'Set workStartTime, workEndTime (HH:mm) and lunchBreakMinutes. ' +
      'standardHoursPerDay is computed automatically from these values.',
  })
  @Patch(':id/work-schedule')
  async updateWorkSchedule(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    return this.organizationService.updateWorkSchedule(account, params.id, dto);
  }
}
