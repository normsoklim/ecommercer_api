import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({ example: '5b6c7d8e-9f0a-1b2c-3d4e-5f6a7b8c9d0e' })
  @IsString()
  paymentId: string;

  @ApiProperty({
    example: 1000,
    minimum: 1,
    description: 'Amount in minor units (cents)',
  })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Customer changed their mind' })
  @IsString()
  @IsOptional()
  reason?: string;
}
