import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from 'src/dto/pagination.dto';

export class SearchWorkLogDto extends PaginationDto {
  @ApiProperty({ description: 'Optional filter by organization ID' })
  organizationId?: string;

  @ApiProperty({
    description:
      'Optional filter by date (ISO 8601). Returns logs for that specific date.',
    example: '2026-03-23',
  })
  date?: string;
}
