import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DiscountType } from './create-discount.dto';

export class ListDiscountsDto {
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

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    default: 0,
    description: 'Number of records to skip',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;

  @ApiPropertyOptional({
    example: 'SUMMER',
    description: 'Filter by discount code (case insensitive)',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Only return active (or inactive) discounts',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsEnum(DiscountType)
  @IsOptional()
  type?: DiscountType;
}
