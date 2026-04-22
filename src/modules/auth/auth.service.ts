import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import slugify from 'slugify';
import environment from 'src/config/environment';
import { AccountMetadata, AccountRole } from 'src/interfaces/Account';
import { MongoId } from 'src/interfaces/MongoId';
import { Account, ACCOUNT_FIELD_SELECTS } from 'src/schemas/account';
import { Notice, NoticeType, NoticeVariant } from 'src/schemas/notice';
import { QrSession, QrSessionStatus } from 'src/schemas/qr-session';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../mail/mail.service';
import { NoticeService } from '../notice/notice.service';
import { LoginResponse } from './auth.controller';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMetadataDto } from './dto/UpdateMetadata.dto';
import { UpdateProfileDto } from './dto/UpdateProfile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<Account>,
    @InjectModel(Notice.name) private noticeModel: Model<Notice>,
    @InjectModel(QrSession.name) private qrSessionModel: Model<QrSession>,
    private jwtService: JwtService,
    private noticeService: NoticeService,
    private mailService: MailService,
  ) {}

  private isProduction = environment().mode === 'production';

  async register({
    inviteCode,
    ...registerDto
  }: RegisterDto): Promise<LoginResponse> {
    const checkExist = await this.accountModel.findOne({
      email: registerDto.email.toLowerCase().trim(),
    });
    if (checkExist) {
      throw new ConflictException('Email already used!');
    }
    const code =
      `${slugify(registerDto.firstName, { trim: true, replacement: '_' })}_${uuidv4().slice(0, 5)}`.toUpperCase();
    const account = await this.accountModel.create({
      ...registerDto,
      metadata: { invitedCode: inviteCode ?? null, myCode: code },
    });
    const payload = { accountId: account._id.toString() };
    const verifyToken = await this.generateToken(account, '30d');
    const url = `${environment().webHost}/verify?token=${verifyToken}`;

    await this.noticeService.createAndSend({
      dto: {
        type: NoticeType.REGISTERED,
        emailMessage: `<p>Welcome to <b>${environment().appName}.</b></p>
            <p>Currently, we’ve noticed a number of spam accounts on the system. To ensure the service remains reliable, we need to verify your email before you can continue.</p>
            <a href="${url}" target="_blank" rel="noopener"
                   style="display:inline-block;padding:10px 16px;background:#28a745;color:#fff;text-decoration:none;border-radius:6px;">
                  Verify now
                </a>
            `,
        message: `<p>Welcome to <b>${environment().appName}.</b></p>
            <p>Currently, we’ve noticed a number of spam accounts on the system. To ensure the service remains reliable, we need to verify your email before you can continue.</p>
            <p>Please check the verify link on your email.</p>
            `,
        variant: NoticeVariant.SUCCESS,
      },
      account,
    });

    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    const info = await this.accountModel
      .findById(account._id)
      .select(ACCOUNT_FIELD_SELECTS);

    return {
      accessToken: token,
      account: info,
    };
  }

  async login(loginDto: LoginDto, ip: string): Promise<LoginResponse> {
    const account = await this.accountModel.findOne({
      email: loginDto.email.toLowerCase().trim(),
      isActivated: true,
    });

    if (!account) {
      throw new NotFoundException('Email or Password is invalid');
    }
    const isPasswordMatching = await bcrypt.compare(
      loginDto.password,
      account.password,
    );

    if (!isPasswordMatching) {
      throw new BadRequestException('Email or Password is invalid');
    }

    const payload = { accountId: account._id.toString() };
    void this.onLogAccount(account, ip);

    if (!account.metadata.myCode) {
      const code = `${account.firstName}_${uuidv4().slice(0, 5)}`.toUpperCase();
      await this.updateMetadata(account, { key: 'myCode', value: code });
    }

    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    const info = await this.accountModel
      .findById(account._id)
      .select(ACCOUNT_FIELD_SELECTS);

    return {
      accessToken: token,
      account: info,
    };
  }

  async onLogAccount(account: Account, ip: string) {
    await this.accountModel.findByIdAndUpdate(
      account._id,
      {
        $addToSet: { ips: ip },
        $set: { lastLoginIp: ip },
      },
      { new: true },
    );
  }

  async find(id: string | MongoId) {
    return this.accountModel.findById(id);
  }

  async changePassword(id: MongoId, data: ChangePasswordDto): Promise<object> {
    try {
      if (data.newPassword !== data.newPasswordConfirm) {
        throw new BadRequestException('Password confirm is invalid');
      }

      const account = await this.accountModel.findById(id);
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      const isPasswordMatching = await bcrypt.compare(
        data.password,
        account.password,
      );

      if (!isPasswordMatching) {
        throw new UnauthorizedException('Password is invalid');
      }

      bcrypt.genSalt(10, (genSaltError, salt): any => {
        if (genSaltError) {
          throw new InternalServerErrorException('Internal server error');
        }

        bcrypt.hash(data.newPassword, salt, async (err, hash): Promise<any> => {
          if (err) {
            throw new InternalServerErrorException('Internal server error');
          }
          await this.accountModel.findByIdAndUpdate(
            id,
            { password: hash },
            { new: true },
          );
        });
      });

      return { message: 'Password changed successfully' };
    } catch (e) {
      throw new InternalServerErrorException('Internal server error');
    }
  }

  async findByAccessToken(accessToken: string): Promise<Account | null> {
    const payload: { accountId: string } = this.jwtService.verify(accessToken, {
      secret: environment().jwt.secret,
    });
    if (!payload.accountId) {
      return null;
    }
    return this.accountModel.findById(payload.accountId);
  }

  async updateProfile(account: Account, dto: UpdateProfileDto) {
    const checkEmail = await this.accountModel.findOne({
      _id: { $ne: account._id },
      email: dto.email,
    });
    if (checkEmail) {
      throw new BadRequestException('Email is existed');
    }
    await this.accountModel.findByIdAndUpdate(
      account._id,
      { ...dto, languages: dto.languages.map((i) => i.toLowerCase()) },
      { new: true },
    );
    return { message: 'Profile updated' };
  }

  async updateMetadata(account: Account, dto: UpdateMetadataDto) {
    const { key, value } = dto;

    await this.accountModel.findByIdAndUpdate(
      account._id,
      {
        $set: {
          [`metadata.${key}`]: value,
        },
      },
      { new: true },
    );

    return { message: 'Metadata updated' };
  }

  async updateTelegram(account: Account, telegramChatId?: string) {
    const metaData: AccountMetadata = account.metadata || {};
    if (telegramChatId) {
      metaData.telegramChatId = telegramChatId;
    } else {
      metaData.telegramChatId = null;
    }

    await this.accountModel.findByIdAndUpdate(
      account._id,
      { $set: { metadata: metaData } },
      { new: true },
    );

    return {
      message: 'Telegram settings updated successfully!',
      telegramChatId: telegramChatId || null,
    };
  }

  async forgotPassword(email: string) {
    const account = await this.accountModel.findOne({ email });
    if (!account) {
      throw new NotFoundException('No matching email address found');
    }
    const token: string = await this.generateToken(account, '3h');
    const url = `${environment().webHost}/reset-password?key=${token}`;

    await account.save();
    await this.mailService.sendMailNormal({
      to: account.email,
      subject: 'Reset password',
      text: `You have requested a password reset, link will expire in 3 hours . Please use this <a href="${url}"><b>link</b></a> to set a new password.`,
    });
    return { message: 'Email sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const { accountId } = this.jwtService.verify<{ accountId: string }>(token);
    const account = await this.accountModel.findById(accountId);
    if (!account) {
      throw new BadRequestException('Invalid reset key');
    }
    bcrypt.genSalt(10, (genSaltError, salt): any => {
      if (genSaltError) {
        throw new InternalServerErrorException('Internal server error');
      }

      bcrypt.hash(newPassword, salt, async (err, hash): Promise<any> => {
        if (err) {
          throw new InternalServerErrorException('Internal server error');
        }
        await this.accountModel.findByIdAndUpdate(
          account._id,
          { password: hash, resetKey: null },
          { new: true },
        );
      });
    });

    return { message: 'Password has been reset' };
  }

  async handleVerify(token: string) {
    try {
      const { accountId } = this.jwtService.verify<{ accountId: string }>(
        token,
      );

      // ✅ Tìm và verify chỉ nếu tài khoản đang chưa verify (atomic)
      const account = await this.accountModel.findOneAndUpdate(
        {
          _id: accountId,
          isVerified: false, // đảm bảo chỉ chạy 1 lần
        },
        {
          $set: { isVerified: true },
        },
        { new: true },
      );

      // ✅ Nếu không tìm thấy tài khoản cần verify → có thể đã verify trước đó
      if (!account) {
        const existing = await this.accountModel.findById(accountId);
        if (!existing) {
          throw new ForbiddenException('Verify key is invalid');
        }
        return {
          message: 'Your account is already verified',
          accountId: existing._id.toString(),
        };
      }

      return {
        message: 'Your account has been verified',
        accountId: account._id.toString(),
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new BadRequestException('Token has expired.');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new BadRequestException('Invalid token.');
      } else {
        throw new BadRequestException('Unknown token error.');
      }
    }
  }

  async generateToken(account: Account, expiresIn: string | number) {
    const token = this.jwtService.sign(
      { accountId: account._id.toString() },
      { expiresIn },
    );
    return token;
  }

  async resendVerifyToken(account: Account) {
    const token: string = await this.generateToken(account, '3d');
    const url = `${environment().webHost}/verify?token=${token}`;
    await this.mailService.sendMailNormal({
      to: account.email,
      subject: 'Verify email',
      text: `<p>Please visit this <a href="${url}"><b>link</b></a> to verify your account.</p>`,
    });
    return 'Email sent';
  }

  async requestDelete(account: Account) {
    if (account.role === AccountRole.ADMIN) {
      throw new ForbiddenException("Can't delete this account");
    }

    // 3. Delete related data
    await this.noticeModel.deleteMany({ account: account._id });

    // 4. Delete user account
    await account.deleteOne();

    return 'Your account has been deleted';
  }

  // ─── QR Login ────────────────────────────────────────────────────────────

  async generateQrSession(): Promise<{
    sessionId: string;
    qrUrl: string;
    expiresAt: Date;
  }> {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.qrSessionModel.create({ sessionId, expiresAt });

    const qrUrl = `${environment().webHost}/qr-login?session=${sessionId}`;
    return { sessionId, qrUrl, expiresAt };
  }

  async getQrStatus(sessionId: string): Promise<{
    status: QrSessionStatus | 'expired';
    token?: string;
    expiresAt?: Date;
  }> {
    const session = await this.qrSessionModel.findOne({ sessionId });

    if (!session || new Date() > session.expiresAt) {
      return { status: 'expired' };
    }

    if (session.status === QrSessionStatus.CONFIRMED) {
      return {
        status: QrSessionStatus.CONFIRMED,
        token: session.token,
        expiresAt: session.expiresAt,
      };
    }

    return { status: session.status, expiresAt: session.expiresAt };
  }

  async confirmQrSession(
    sessionId: string,
    account: Account,
  ): Promise<{ message: string }> {
    const session = await this.qrSessionModel.findOne({ sessionId });

    if (!session || new Date() > session.expiresAt) {
      throw new BadRequestException('QR session has expired or does not exist');
    }

    if (session.status !== QrSessionStatus.PENDING) {
      throw new BadRequestException('QR session is no longer valid');
    }

    const payload = { accountId: account._id.toString() };
    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.qrSessionModel.findByIdAndUpdate(session._id, {
      $set: {
        status: QrSessionStatus.CONFIRMED,
        account: account._id,
        token,
      },
    });

    return { message: 'QR login confirmed successfully' };
  }

  // ─────────────────────────────────────────────────────────────────────────

  setAuthCookie(res: Response, token: string): void {
    const isProd = this.isProduction;

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: isProd ? true : false,
      sameSite: isProd ? 'none' : 'lax', // MUST BE none for WebSocket cross-origin
      domain: isProd ? `.${environment().domain}` : 'localhost',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  async logout(res: Response) {
    res.clearCookie('accessToken');
    res.status(200).send({ statusCode: 200, content: { success: true } });
  }

  async verifyOtp(
    email: string,
    otpCode: string,
    res: Response,
  ): Promise<void> {
    const account = await this.accountModel.findOne({
      email: email.toLowerCase().trim(),
      isActivated: true,
      role: AccountRole.ADMIN,
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const metadata = account.metadata || {};

    // Check if OTP exists
    if (!metadata.otpCode || !metadata.otpExpiry) {
      throw new BadRequestException(
        'No OTP request found. Please login again.',
      );
    }

    // Check if OTP is expired
    if (new Date() > new Date(metadata.otpExpiry)) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    // Check if OTP matches
    if (metadata.otpCode !== otpCode) {
      throw new BadRequestException('Invalid OTP code');
    }

    // OTP is valid - complete the login
    const pendingIp = metadata.pendingLoginIp || '';

    // Clear OTP data and log the IP
    await this.accountModel.findByIdAndUpdate(account._id, {
      $set: {
        'metadata.otpCode': null,
        'metadata.otpExpiry': null,
        'metadata.otpVerified': true,
        'metadata.pendingLoginIp': null,
      },
    });

    // Log the IP
    void this.onLogAccount(account, pendingIp);

    // Generate token
    const payload = { accountId: account._id.toString() };
    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    this.setAuthCookie(res, token);

    const info = await this.accountModel
      .findById(account._id)
      .select(ACCOUNT_FIELD_SELECTS);

    res.json({
      statusCode: 200,
      content: {
        account: info,
        message: 'Login successful',
      },
    });
  }

  async resendOtp(email: string): Promise<object> {
    const account = await this.accountModel.findOne({
      email: email.toLowerCase().trim(),
      isActivated: true,
      role: AccountRole.ADMIN,
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const metadata = account.metadata || {};

    // Check if there's a pending OTP request
    if (!metadata.pendingLoginIp) {
      throw new BadRequestException(
        'No pending OTP request found. Please login again.',
      );
    }

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update OTP
    await this.accountModel.findByIdAndUpdate(account._id, {
      $set: {
        'metadata.otpCode': otpCode,
        'metadata.otpExpiry': otpExpiry,
      },
    });

    // Send new OTP via email
    await this.mailService.sendMailNormal({
      to: account.email,
      subject: 'OTP Login Verification - Admin Account (Resent)',
      text: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">🔐 Admin Login Verification (Resent)</h2>
            <p>You requested a new verification code. Your new OTP is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4CAF50; background-color: #f0f0f0; padding: 15px 30px; border-radius: 8px; display: inline-block;">
                ${otpCode}
              </span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              If you didn't request this, please secure your account immediately.
            </p>
          </div>
        </div>
      `,
    });

    return { message: 'New OTP has been sent to your email' };
  }
}
