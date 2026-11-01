import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Electronics', minLength: 1, maxLength: 200 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'electronics', minLength: 1, maxLength: 200 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({
    example: 'All electronic devices and accessories',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: '0f0d2a1c-6c1a-4a53-9d1a-2f1d3c4b5a6e',
    description: 'Id of the parent category',
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/electronics.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
