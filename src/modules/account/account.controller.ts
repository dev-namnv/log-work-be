import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from 'src/decorators/auth.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import { AccountRole } from 'src/interfaces/Account';
import { Account } from 'src/schemas/account';
import { AccountService } from './account.service';
import { SearchAccountDto } from './dto/searchAccount.dto';

@SkipCache()
@Auth(AccountRole.ADMIN)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @ApiTags('Account')
  @ApiOperation({ summary: 'Search account' })
  @ApiResponse({ type: [Account], status: 200 })
  @SkipThrottle()
  @Post('/search')
  async search(@Body() dto: SearchAccountDto) {
    return this.accountService.searchAccount(dto);
  }

  @ApiTags('Account')
  @ApiOperation({ summary: 'Detail account' })
  @Get(':id/detail')
  async detail(@Param() dto: MongoIdDto) {
    return this.accountService.detail(dto.id);
  }

  @ApiTags('Account')
  @ApiOperation({ summary: 'Delete account' })
  @Delete(':id/delete')
  async delete(@Param() dto: MongoIdDto) {
    return this.accountService.delete(dto.id);
  }
}
