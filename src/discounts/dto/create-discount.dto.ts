import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/**
 * Discount kinds supported by the API.
 *
 * `FIXED` and `FIXED_AMOUNT` are equivalent, both are stored as
 * `FIXED_AMOUNT` in the database (see the `CouponType` Prisma enum).
 */
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export class CreateDiscountDto {
  @ApiProperty({ example: 'SUMMER2024', minLength: 1, maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code: string;

  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({
    example: 20,
    description:
      'Discount value: percentage points when the type is PERCENTAGE, otherwise an amount in minor units (cents)',
  })
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  value: number;

  @ApiProperty({ example: '2024-06-01T00:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-08-31T23:59:59Z' })
  @IsDateString()
  endDate: string;

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

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
