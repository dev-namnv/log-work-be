import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { Account } from 'src/schemas/account';
import { UpdateUserRefDto } from './dto/update-user-ref.dto';
import { UserRefService } from './user-ref.service';

@SkipCache()
@Auth()
@ApiTags('UserRef')
@Controller('user-ref')
export class UserRefController {
  constructor(private readonly userRefService: UserRefService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user reference data (last used org, etc.)',
  })
  async get(@CurrentAccount() account: Account) {
    return this.userRefService.getForAccount(account._id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user reference data' })
  async update(
    @CurrentAccount() account: Account,
    @Body() dto: UpdateUserRefDto,
  ) {
    return this.userRefService.updateForAccount(account._id, dto);
  }
}
