import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { getRealClientIp } from 'src/common/ip.helper';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { Account } from 'src/schemas/account';
import { UpdateTelegramDto } from '../account/dto/updateTelegram.dto';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { ForgotPasswordDto } from './dto/forgotPassword.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmQrLoginDto } from './dto/qrLogin.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateMetadataDto } from './dto/UpdateMetadata.dto';
import { UpdateProfileDto } from './dto/UpdateProfile.dto';
import { VerifyAccountDto } from './dto/verifyAccount.dto';
import { ResendOtpDto, VerifyOtpDto } from './dto/verifyOtp.dto';

export interface LoginResponse {
  accessToken: string;
  account: Account;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Account register' })
  async create(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('/login')
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Account login' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, getRealClientIp(req));
  }

  @ApiTags('Auth')
  @Auth()
  @SkipCache()
  @Get('/profile')
  async getProfile(@Req() req: Request): Promise<Account | null> {
    const account = req.user as Account;
    if (account) {
      void this.authService.onLogAccount(account, getRealClientIp(req));
    }
    return account;
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Change password' })
  @Auth()
  @Patch('/change-password')
  async changePassword(
    @CurrentAccount() account: Account,
    @Body() data: ChangePasswordDto,
  ): Promise<object | Observable<never>> {
    return this.authService.changePassword(account.id, data);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Update profile' })
  @Auth()
  @Put('/update-profile')
  async updateProfile(
    @CurrentAccount() account: Account,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(account, dto);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Update metadata' })
  @Auth()
  @Patch('/update-metadata')
  async updateMetadata(
    @CurrentAccount() account: Account,
    @Body() dto: UpdateMetadataDto,
  ) {
    return this.authService.updateMetadata(account, dto);
  }

  @ApiTags('Auth')
  @ApiOperation({
    summary: 'Update Telegram notification settings',
    description:
      'Set Telegram Chat ID to receive real-time notifications. Leave empty or send null to disable.',
  })
  @Auth()
  @Patch('/update-telegram')
  async updateTelegram(
    @CurrentAccount() account: Account,
    @Body() dto: UpdateTelegramDto,
  ) {
    return this.authService.updateTelegram(account, dto.telegramChatId);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Send forgot password' })
  @Post('/forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Reset password' })
  @Post('/reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.key, dto.password);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Verify account' })
  @Post('/verify/check/:token')
  async verifyAccount(@Param() dto: VerifyAccountDto) {
    return this.authService.handleVerify(dto.token);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Resend verify account' })
  @Auth()
  @Post('/verify/resend')
  async resendVerifyAccount(@CurrentAccount() account: Account) {
    return this.authService.resendVerifyToken(account);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Request delete account' })
  @Auth()
  @Delete('request-delete')
  async requestDelete(@CurrentAccount() account: Account) {
    return this.authService.requestDelete(account);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Verify OTP for admin login' })
  @Post('/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res() res: Response) {
    return this.authService.verifyOtp(dto.email, dto.otp, res);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Resend OTP for admin login' })
  @Post('/resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  @ApiTags('Auth')
  @ApiOperation({ summary: 'Logout' })
  @Post('logout')
  async logout(@Res() res: Response) {
    return this.authService.logout(res);
  }

  @ApiTags('Auth - QR Login')
  @ApiOperation({ summary: 'Generate QR login session' })
  @Post('/qr/generate')
  async generateQrSession() {
    return this.authService.generateQrSession();
  }

  @ApiTags('Auth - QR Login')
  @ApiOperation({ summary: 'Poll QR session status' })
  @SkipThrottle()
  @Get('/qr/status/:sessionId')
  async getQrStatus(@Param('sessionId') sessionId: string) {
    return this.authService.getQrStatus(sessionId);
  }

  @ApiTags('Auth - QR Login')
  @ApiOperation({ summary: 'Confirm QR login (requires mobile auth)' })
  @Auth()
  @SkipCache()
  @Post('/qr/confirm')
  async confirmQrLogin(
    @CurrentAccount() account: Account,
    @Body() dto: ConfirmQrLoginDto,
  ) {
    return this.authService.confirmQrSession(dto.sessionId, account);
  }
}
