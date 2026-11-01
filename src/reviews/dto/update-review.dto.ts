import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    example: 4,
    minimum: 1,
    maximum: 5,
    description: 'New rating of the review',
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    example: 'Great value for the price',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated comment of the customer.',
    maxLength: 2000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Only an ADMIN or STAFF member can hide a review. Customers can only edit the content of their own review.',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
