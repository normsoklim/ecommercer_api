import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListProductImagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
    description: 'Only return the images of this product',
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Only return the primary image of the product',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  })
  isPrimary?: boolean;
}
