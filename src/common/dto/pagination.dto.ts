import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Number of items per page' })
  limit: number;

  @ApiProperty({
    example: 137,
    description: 'Total number of matching records',
  })
  total: number;

  @ApiProperty({ example: 7, description: 'Total number of pages' })
  totalPages: number;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: 1,
    description: 'Page number to fetch (1-based)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Number of records to return per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

/**
 * Builds an OpenAPI schema for the `{ data, meta }` envelope returned by every
 * paginated endpoint of the API.
 */
export function paginatedResponseSchema(
  item: SchemaObject | ReferenceObject,
): SchemaObject {
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: item },
      meta: { $ref: '#/components/schemas/PaginationMetaDto' },
    },
    required: ['data', 'meta'],
  };
}
