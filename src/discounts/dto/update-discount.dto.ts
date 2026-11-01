import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType } from './create-discount.dto';

export class UpdateDiscountDto {
  @ApiPropertyOptional({ example: 'SUMMER2024', minLength: 1, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code?: string;

  @ApiPropertyOptional({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  @IsOptional()
  type?: DiscountType;

  @ApiPropertyOptional({
    example: 20,
    description:
      'Discount value: percentage points when the type is PERCENTAGE, otherwise an amount in minor units (cents)',
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100_000_000)
  value?: number;

  @ApiPropertyOptional({ example: '2024-06-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-08-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Minimum order amount in minor units (cents)',
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  minPurchase?: number;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Maximum discount amount in minor units (cents)',
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Maximum number of uses' })
  @IsInt()
  @IsOptional()
  @Min(0)
  maxUses?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
