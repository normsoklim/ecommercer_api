import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ShippingAddressDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional({ example: 'E-commerce Inc.' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ example: '123 Rama IV Road' })
  @IsString()
  @MinLength(1)
  addressLine1: string;

  @ApiProperty({ example: '+8559728465' })
  @IsString()
  @MinLength(1)
  phone: string;
}
