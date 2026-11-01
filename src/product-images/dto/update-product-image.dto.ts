import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { IMAGE_URL_PATTERN } from './create-product-image.dto';

export class UpdateProductImageDto {
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/products/headphones-side.png',
    description: 'Absolute http(s) URL or root relative path of the image',
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(IMAGE_URL_PATTERN, {
    message:
      'url must be an absolute http(s) URL or a root relative path starting with "/"',
  })
  url?: string;

  @ApiPropertyOptional({
    example: 'Side view of the wireless headphones',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'When true this becomes the only primary image of the product',
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
