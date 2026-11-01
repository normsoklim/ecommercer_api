import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum InventoryMovementType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  RESERVATION = 'RESERVATION',
  RELEASE = 'RELEASE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class AdjustInventoryDto {
  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ example: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d' })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional({
    enum: InventoryMovementType,
    example: InventoryMovementType.ADJUSTMENT,
    description:
      'Movement type. Defaults to ADJUSTMENT, which applies `quantity` as a signed delta on the current stock.',
  })
  @IsEnum(InventoryMovementType)
  @IsOptional()
  type?: InventoryMovementType;

  @ApiProperty({
    example: 10,
    description: 'Signed quantity. Negative removes stock.',
  })
  @Type(() => Number)
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({ example: '1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ example: 'order' })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'Restock from supplier' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 'Manual adjustment',
    description: 'Alias for `notes`.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
