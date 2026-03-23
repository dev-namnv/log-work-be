import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { AccountRole } from 'src/interfaces/Account';
import { Account } from 'src/schemas/account';
import { NoticeToSomeUsersDto } from './dto/NoticeToSomeUsers.dto';
import { NoticeToUserDto } from './dto/NoticeToUser.dto';
import { NoticeToUsersDto } from './dto/NoticeToUsers.dto';
import { NoticeService } from './notice.service';

@Controller('notice')
export class NoticeController {
  constructor(private noticeService: NoticeService) {}

  @ApiTags('Notice')
  @ApiOperation({ summary: 'Get all notices are not viewed' })
  @Auth()
  @SkipCache()
  @Get('all')
  async getNotViewed(@CurrentAccount() account: Account) {
    return this.noticeService.getNotViewedByAccount(account);
  }

  @ApiTags('Notice')
  @ApiOperation({ summary: 'Get all notices are not viewed' })
  @Auth()
  @Patch(':id/mask-as-read')
  async maskAsRead(@Param() idDto: MongoIdDto) {
    return this.noticeService.maskAsRead(idDto.id);
  }

  @ApiTags('Notice')
  @ApiOperation({ summary: 'Clear all notices' })
  @Auth()
  @Post('clear-all')
  async clearAll(@CurrentAccount() account: Account) {
    return this.noticeService.clearAllByAccount(account);
  }

  @ApiTags('Notice')
  @ApiOperation({ summary: 'Send a notice to all users' })
  @Auth(AccountRole.ADMIN)
  @Post('notice-to-all-users')
  async noticeToAllUser(@Body() dto: NoticeToUsersDto) {
    return this.noticeService.noticeToAllUsers(dto);
  }

  @ApiTags('Notice')
  @ApiOperation({ summary: 'Send a notice to a user' })
  @Auth(AccountRole.ADMIN)
  @Post('notice-to-user')
  async noticeToUser(@Body() dto: NoticeToUserDto) {
    return this.noticeService.noticeToUser(dto.id, dto);
  }

  @ApiTags('Notice')
  @ApiOperation({ summary: 'Send a notice to some users' })
  @Auth(AccountRole.ADMIN)
  @Post('notice-to-some-users')
  async noticeToSomeUsers(@Body() dto: NoticeToSomeUsersDto) {
    return this.noticeService.noticeToSomeUsers(dto.ids, dto);
  }
}
