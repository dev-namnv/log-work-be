import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { Account } from 'src/schemas/account';
import { ClockService } from './clock.service';
import { ClockCheckInDto } from './dto/clockCheckIn.dto';
import { ClockCheckOutDto } from './dto/clockCheckOut.dto';
import { ClockRecentLogsDto } from './dto/clockRecentLogs.dto';

/**
 * Clock Device API
 * ─────────────────────────────────────────────────────────────
 * Designed for kiosk / tablet clock devices. Authentication is
 * done via QR login:
 *
 *  1. Device calls  POST /auth/qr/generate
 *       → renders QR code from the returned `qrUrl`
 *
 *  2. Employee scans QR with mobile app (already logged in)
 *       → mobile calls  POST /auth/qr/confirm  { sessionId }
 *
 *  3. Device polls  GET /auth/qr/status/:sessionId
 *       → when status === "confirmed", response contains `token`
 *
 *  4. Device sends `Authorization: Bearer <token>` on every
 *     subsequent request to this Clock API.
 * ─────────────────────────────────────────────────────────────
 */
@ApiTags('Clock')
@ApiBearerAuth()
@SkipCache()
@Auth()
@Controller('clock')
export class ClockController {
  constructor(private readonly clockService: ClockService) {}

  // ─── Check-In ──────────────────────────────────────────────

  @ApiOperation({
    summary: 'Quick check-in',
    description:
      'Records check-in with the current server time. ' +
      'Returns 400 if a work-log for today already exists for the given organization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Work log created with check-in time.',
  })
  @ApiResponse({ status: 400, description: 'Already checked in today.' })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this organization.',
  })
  @ApiResponse({ status: 404, description: 'Organization not found.' })
  @Post('check-in')
  async checkIn(
    @CurrentAccount() account: Account,
    @Body() dto: ClockCheckInDto,
  ) {
    return this.clockService.checkIn(account, dto);
  }

  // ─── Check-Out ─────────────────────────────────────────────

  @ApiOperation({
    summary: 'Quick check-out',
    description:
      'Records check-out with the current server time and computes total worked hours ' +
      '(deducting lunch break from the org schedule). ' +
      'Returns 404 if the employee has not checked in today.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work log updated with check-out time and hours.',
  })
  @ApiResponse({ status: 400, description: 'Already checked out today.' })
  @ApiResponse({ status: 404, description: 'No check-in found for today.' })
  @Patch('check-out')
  async checkOut(
    @CurrentAccount() account: Account,
    @Body() dto: ClockCheckOutDto,
  ) {
    return this.clockService.checkOut(account, dto);
  }

  // ─── Today Status ──────────────────────────────────────────

  @ApiOperation({
    summary: "Today's status",
    description:
      'Returns whether the employee has checked in / checked out today, ' +
      'along with the current work-log entry if it exists.',
  })
  @ApiResponse({
    status: 200,
    description: 'Today status',
    schema: {
      example: {
        date: '2026-04-21T00:00:00.000Z',
        checkedIn: true,
        checkedOut: false,
        log: {
          _id: '6627abc123',
          checkIn: '2026-04-21T08:03:42.000Z',
          checkOut: null,
          hours: 0,
          organization: { _id: '...', name: 'Acme Corp' },
        },
      },
    },
  })
  @Get('today')
  async today(
    @CurrentAccount() account: Account,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.clockService.today(account, organizationId);
  }

  // ─── Recent Logs ───────────────────────────────────────────

  @ApiOperation({
    summary: 'Recent work logs',
    description:
      'Returns the most recent work-log entries for the authenticated employee, ' +
      'sorted by date descending. Useful for the clock device to show attendance history.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of recent work logs, newest first.',
    schema: {
      example: [
        {
          _id: '6627abc123',
          date: '2026-04-21T00:00:00.000Z',
          checkIn: '2026-04-21T08:03:00.000Z',
          checkOut: '2026-04-21T17:31:00.000Z',
          hours: 8.5,
          organization: { _id: '...', name: 'Acme Corp' },
        },
      ],
    },
  })
  @Get('recent-logs')
  async recentLogs(
    @CurrentAccount() account: Account,
    @Query() dto: ClockRecentLogsDto,
  ) {
    return this.clockService.recentLogs(account, dto);
  }
}
