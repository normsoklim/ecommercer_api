import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.SHIPPED })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ example: 'TH123456789' })
  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @ApiPropertyOptional({ example: 'DHL' })
  @IsString()
  @IsOptional()
  carrier?: string;
}
