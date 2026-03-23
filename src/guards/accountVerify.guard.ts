import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Account } from 'src/schemas/account';

@Injectable()
export class AccountVerifyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as Account;

    if (!user) {
      throw new ForbiddenException('Account not found');
    }
    if (!user.isVerified) {
      throw new ForbiddenException('Your account has not been verified yet.');
    }

    return true;
  }
}
