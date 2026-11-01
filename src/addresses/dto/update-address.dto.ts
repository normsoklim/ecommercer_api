import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAddressDto {
  @ApiPropertyOptional({
    enum: ['Home', 'Office', 'Other'],
    example: 'Office',
  })
  @IsOptional()
  @IsIn(['Home', 'Office', 'Other'])
  label?: string;

  @ApiPropertyOptional({
    example: '+8559728465',
    minLength: 6,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  recipientPhone?: string;

  @ApiPropertyOptional({
    example: 'House 12, Street 123',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string;

  @ApiPropertyOptional({
    example: '123 Rama IV Road, Phnom Penh, Cambodia',
    minLength: 3,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  formattedAddress?: string;

  @ApiPropertyOptional({
    example: 11.5564,
  })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({
    example: 104.9282,
  })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({
    example: 'ChIJD3d89ndGDoARo6XDcLm7Q',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeId?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  isDefault?: boolean;

}
