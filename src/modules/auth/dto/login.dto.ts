import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches, MinLength } from 'class-validator';
import Regex from 'src/common/regex';

export class LoginDto {
  @ApiProperty({ example: '' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  @IsEmail(
    {},
    {
      message: 'Email is invalid',
    },
  )
  email: string;

  @ApiProperty({ example: '' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MinLength(6, { message: 'Password must be greater than 6 characters' })
  @Matches(Regex.password, {
    message: 'Password contains invalid characters',
  })
  password: string;
}
