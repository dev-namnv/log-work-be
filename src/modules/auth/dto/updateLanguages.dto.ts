import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateLanguagesDto {
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
