import { applyDecorators, UseGuards } from '@nestjs/common';
import { AccountVerifyGuard } from 'src/guards/accountVerify.guard';
import { ApiJWTAuth } from './apiJwtAuth.decorator';

export const AccountVerified = (apiDocJwt?: boolean) =>
  applyDecorators(ApiJWTAuth(apiDocJwt), UseGuards(AccountVerifyGuard));
