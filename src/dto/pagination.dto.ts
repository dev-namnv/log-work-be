import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SortOrder } from 'mongoose';

class Search {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty()
  @IsNotEmpty()
  value: string | number | boolean;
}

class Sort {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsIn([-1, 1, 'asc', 'ascending', 'desc', 'descending'])
  @IsNotEmpty()
  order: SortOrder;
}

export class PaginationDto {
  @ApiProperty({ required: false, default: 1 })
  @Min(1)
  @IsNumber()
  @IsOptional()
  page: number;

  @ApiProperty({ required: false, default: 20 })
  @Min(1)
  @Max(100)
  @IsNumber()
  @IsOptional()
  limit: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Search)
  @IsOptional()
  search?: Search[];

  @ApiProperty({ required: false })
  @Type(() => Sort)
  @IsOptional()
  sort?: Sort;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  keyword?: string;
}
