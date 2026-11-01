import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListReviewsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
    description: 'Only return the reviews of this product',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Only return the reviews having this rating',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    description: 'Only return the reviews written by this user',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Only return the active (or hidden) reviews. Reserved to the ADMIN and STAFF members.',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  })
  isActive?: boolean;
}
