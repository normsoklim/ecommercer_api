import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: 'Wireless Headphones',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    example: 'wireless-headphones',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ example: 'WH-1000XM5', minLength: 1, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: '0f0d2a1c-6c1a-4a53-9d1a-2f1d3c4b5a6e' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Over-ear noise cancelling headphones',
    maxLength: 5000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    example: 'Premium over-ear headphones',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  shortDescription?: string;

  @ApiPropertyOptional({
    example: 29900,
    minimum: 0,
    description: 'Base price in minor units (cents)',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({
    example: 34900,
    minimum: 0,
    description: 'Compare-at price in minor units (cents)',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({
    example: 0.35,
    minimum: 0,
    description: 'Weight in kilograms',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
