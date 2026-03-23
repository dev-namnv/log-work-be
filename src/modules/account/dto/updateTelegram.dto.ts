import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTelegramDto {
  @ApiProperty({
    description: 'Telegram Chat ID for receiving notifications',
    required: false,
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  telegramChatId?: string;
}
