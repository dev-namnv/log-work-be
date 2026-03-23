import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import environment from 'src/config/environment';
import { Account, ACCOUNT_FIELD_SELECTS } from 'src/schemas/account';

export interface JwtPayload {
  accountId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(Account.name) private accountModel: Model<Account>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          return req?.cookies?.accessToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: environment().jwt.secret,
    });
  }

  async validate(payload: JwtPayload): Promise<Account> {
    // Nếu payload không có accountId, token không hợp lệ hoặc đã hết hạn
    if (!payload || !payload.accountId) {
      throw new UnauthorizedException('Token is invalid or expired');
    }

    // Tìm account trong database
    const account = await this.accountModel
      .findById(payload.accountId)
      .select(ACCOUNT_FIELD_SELECTS);

    if (!account) {
      // Account không tồn tại - có thể đã bị xóa
      throw new ForbiddenException('Account not found or has been deleted');
    }

    return account;
  }
}
