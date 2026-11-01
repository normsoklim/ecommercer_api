import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  BAKONG_KHQR = 'BAKONG_KHQR',
}

export class CreatePaymentDto {
  @ApiProperty({ example: '1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsString()
  orderId: string;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.STRIPE })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiProperty({
    example: 29900,
    minimum: 0,
    description: 'Amount in minor units (cents)',
  })
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    example: 'idem-9a8b7c6d-5e4f',
    description: 'Idempotency key to safely retry the request',
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
