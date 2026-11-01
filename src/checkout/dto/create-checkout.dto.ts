import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingAddressDto } from './shipping-address.dto';

export class CreateCheckoutDto {
  @ApiPropertyOptional({
    example: 'idem-9a8b7c6d-5e4f',
    description: 'Idempotency key to safely retry the request',
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({
    type: ShippingAddressDto,
    description: 'Where the order should be shipped',
  })
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({ example: 'SUMMER10' })
  @IsString()
  @IsOptional()
  couponCode?: string;
}
