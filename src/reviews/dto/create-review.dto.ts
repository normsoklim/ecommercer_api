import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
    description: 'Product the review belongs to',
  })
  @IsString()
  @IsUUID()
  productId: string;

  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Rating given to the product',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    example: 'Excellent noise cancelling',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'The battery lasts more than a week with ANC enabled.',
    maxLength: 2000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}
