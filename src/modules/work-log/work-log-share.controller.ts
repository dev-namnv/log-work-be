import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { Account } from 'src/schemas/account';
import { CreateShareLinkDto } from './dto/createShareLink.dto';
import { WorkLogService } from './work-log.service';

/**
 * Work Log Share endpoints.
 *
 * Authenticated routes (require JWT cookie):
 *   POST   /work-log/share          — generate a new share link
 *   GET    /work-log/share          — list current user's share links
 *   DELETE /work-log/share/:id/delete — revoke a share link
 *
 * Public route (no auth required — accessible by HR / accounting):
 *   GET    /work-log/share/:token/view — view the shared monthly report
 */
@SkipCache()
@Controller('work-log/share')
export class WorkLogShareController {
  constructor(private readonly workLogService: WorkLogService) {}

  @ApiTags('WorkLog Share')
  @ApiOperation({
    summary: 'Create a shareable monthly report link',
    description:
      'Generates a unique token-based public URL for a monthly work report. The link can optionally be scoped to one organization and can carry an expiry date.',
  })
  @Auth()
  @Post()
  async create(
    @CurrentAccount() account: Account,
    @Body() dto: CreateShareLinkDto,
  ) {
    return this.workLogService.createShareLink(account, dto);
  }

  @ApiTags('WorkLog Share')
  @ApiOperation({ summary: "List current user's share links" })
  @Auth()
  @Get()
  async list(@CurrentAccount() account: Account) {
    return this.workLogService.listShareLinks(account);
  }

  @ApiTags('WorkLog Share')
  @ApiOperation({ summary: 'Revoke (delete) a share link' })
  @Auth()
  @Delete(':id/delete')
  async revoke(
    @CurrentAccount() account: Account,
    @Param() params: MongoIdDto,
  ) {
    return this.workLogService.revokeShareLink(account, params.id);
  }

  @ApiTags('WorkLog Share')
  @ApiOperation({
    summary: 'View shared monthly report (public — no login required)',
    description:
      'Returns full monthly work-log data: account info, organization, total hours, OT hours, attendance rate and individual log entries. Intended to be shared with HR or accounting.',
  })
  @Get(':token/view')
  async view(@Param('token') token: string) {
    return this.workLogService.viewSharedReport(token);
  }
}
