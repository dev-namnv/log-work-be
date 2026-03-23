import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'First name cannot be empty' })
  firstName: string;

  @ApiProperty()
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

  @ApiProperty({ type: [String] })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((text) => text.trim()) : [],
  )
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @IsNotEmpty({ each: true })
  languages: string[];
}
