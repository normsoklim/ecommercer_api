import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.CAPTURED })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiPropertyOptional({ example: 'pi_1234567890' })
  @IsString()
  @IsOptional()
  providerTransactionId?: string;

  @ApiPropertyOptional({
    example: { id: 'pi_1234567890', amount: 29900 },
    description: 'Raw provider response stored for auditing',
  })
  @IsObject()
  @IsOptional()
  rawResponse?: any;
}
