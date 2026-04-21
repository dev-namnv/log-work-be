import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmQrLoginDto {
  @ApiProperty({ description: 'QR session ID to confirm' })
  @IsNotEmpty()
  @IsString()
  @Length(36, 36)
  sessionId: string;
}
