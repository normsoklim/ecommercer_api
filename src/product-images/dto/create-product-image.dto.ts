import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Accepts either an absolute http(s) URL (https://cdn.example.com/a.png) or a
 * root relative path served by the API (/uploads/a.png).
 */
export const IMAGE_URL_PATTERN = /^(https?:\/\/[^\s]+|\/[^\s]*)$/i;

export class CreateProductImageDto {
  @ApiProperty({
    example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
    description: 'Product the image belongs to',
  })
  @IsString()
  productId: string;

  @ApiProperty({
    example: 'https://cdn.example.com/products/headphones-front.png',
    description: 'Absolute http(s) URL or root relative path of the image',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(IMAGE_URL_PATTERN, {
    message:
      'url must be an absolute http(s) URL or a root relative path starting with "/"',
  })
  url: string;

  @ApiPropertyOptional({
    example: 'Front view of the wireless headphones',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'When true this becomes the only primary image of the product',
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
