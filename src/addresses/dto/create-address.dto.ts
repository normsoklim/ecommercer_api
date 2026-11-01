import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const ADDRESS_LABELS = ['Home', 'Office', 'Other'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export class CreateAddressDto {
  @ApiProperty({
    enum: ['Home', 'Office', 'Other'],
    example: 'Home',
    description: 'Delivery label of the address, e.g. Home or Office',
  })
  @IsIn(['Home', 'Office', 'Other'])
  label!: string;

  @ApiProperty({
    example: '+8559728465',
    minLength: 6,
    maxLength: 30,
    description: 'Recipient phone number used for the delivery',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  recipientPhone!: string;

  @ApiPropertyOptional({
    example: 'House 12, Street 123',
    maxLength: 500,
    description: 'Optional house number, street and delivery instructions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string;

  @ApiProperty({
    example: '123 Rama IV Road, Phnom Penh, Cambodia',
    minLength: 3,
    maxLength: 1000,
    description: 'Readable address of the selected coordinates',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  formattedAddress!: string;

  @ApiProperty({
    example: 11.5564,
    description: 'Latitude of the delivery coordinates',
  })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({
    example: 104.9282,
    description: 'Longitude of the delivery coordinates',
  })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({
    example: 'ChIJD3d89ndGDoARo6XDcLm7Q',
    maxLength: 255,
    description: 'Google Places identifier of the selected address',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeId?: string;

}
