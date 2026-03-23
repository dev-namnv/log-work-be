import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import environment from 'src/config/environment';
import { Auth, AuthOptional } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { Account } from 'src/schemas/account';

@Controller()
export class AppController {
  private webHost = environment().webHost;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  @ApiTags('App')
  @ApiOperation({ summary: 'Clear all caching' })
  @SkipCache()
  @Get('clear-caching')
  async clearCache() {
    await this.cacheManager.reset();
    return 'Cache was clear!';
  }

  @ApiTags('App')
  @ApiOperation({ summary: 'Test Auth with cookie (requires login)' })
  @SkipCache()
  @Auth()
  @Get('test-auth')
  async testAuth(@CurrentAccount() account: Account) {
    return {
      message: 'Auth works with cookie!',
      account: {
        id: account._id,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
      },
    };
  }

  @ApiTags('App')
  @ApiOperation({
    summary: 'Test AuthOptional with cookie (no login required)',
  })
  @SkipCache()
  @AuthOptional()
  @Get('test-auth-optional')
  async testAuthOptional(@CurrentAccount() account?: Account) {
    return {
      message: 'AuthOptional works!',
      isAuthenticated: !!account,
      account: account
        ? {
            id: account._id,
            email: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
          }
        : null,
    };
  }
}
