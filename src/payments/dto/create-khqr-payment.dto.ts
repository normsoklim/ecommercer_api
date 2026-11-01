import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsIn,
} from 'class-validator';

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  BAKONG_KHQR = 'BAKONG_KHQR',
}

export class CreateKhqrPaymentDto {
  @ApiProperty({
    description: 'Order ID to create payment for',
    example: '1',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Payment provider',
    enum: PaymentProvider,
    default: PaymentProvider.BAKONG_KHQR,
  })
  @IsString()
  @IsNotEmpty()
  provider: PaymentProvider;

  @ApiProperty({
    description: 'Currency for the payment (USD or KHR)',
    example: 'USD',
    default: 'USD',
    enum: ['USD', 'KHR'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['USD', 'KHR'])
  currency: string;

  @ApiProperty({
    description: 'Idempotency key to prevent duplicate payments',
    example: 'unique-key-12345',
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
