import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwtAuth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { AccountRole } from 'src/interfaces/Account';
import { JwtAuthOptionalGuard } from '../guards/jwtAuthOptional.guard';
import { ApiJWTAuth } from './apiJwtAuth.decorator';
import { Roles } from './roles.decorator';

export const Auth = (...roles: AccountRole[]) =>
  applyDecorators(
    ApiJWTAuth(),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
  );

export const AuthOptional = () =>
  applyDecorators(ApiJWTAuth(false), UseGuards(JwtAuthOptionalGuard));
