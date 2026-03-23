import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/decorators/dto/trim';

export class RegisterDto {
  @ApiProperty()
  @Trim()
  @IsNotEmpty({ message: 'First name cannot be empty' })
  firstName: string;

  @ApiProperty()
  @Trim()
  @IsNotEmpty({ message: 'Last name cannot be empty' })
  lastName: string;

  @ApiProperty()
  @IsEmail(
    {},
    {
      message: 'Email is invalid',
    },
  )
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty()
  @Matches(/^[^\s\r\n\t]+$/, {
    message: 'Password contains invalid characters"',
  })
  @MinLength(6, { message: 'Password must be greater than 6 characters' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  password: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  inviteCode?: string;
}
