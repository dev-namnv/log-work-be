import { SetMetadata } from '@nestjs/common';
import { AccountRole } from 'src/interfaces/Account';

export const Roles = (...roles: AccountRole[]): any =>
  SetMetadata('roles', roles);
