import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class VerifyKhqrPaymentDto {
  @ApiProperty({
    description: 'Transaction hash from the banking app (optional)',
    example: 'abc123def456',
    required: false,
  })
  @IsString()
  @IsOptional()
  transactionHash?: string;
}
