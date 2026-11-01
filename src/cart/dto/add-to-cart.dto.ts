import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @ApiProperty({ example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ example: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d' })
  @IsString()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
