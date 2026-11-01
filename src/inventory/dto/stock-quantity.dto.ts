import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StockQuantityDto {
  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ example: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d' })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: '1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsString()
  orderId: string;
}
