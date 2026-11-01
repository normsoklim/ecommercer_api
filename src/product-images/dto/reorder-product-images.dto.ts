import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderProductImageDto {
  @ApiProperty({
    example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
    description: 'Id of the product image being repositioned',
  })
  @IsString()
  id: string;

  @ApiProperty({ example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderProductImagesDto {
  @ApiProperty({
    type: [ReorderProductImageDto],
    description: 'The new ordering of the product images',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReorderProductImageDto)
  images: ReorderProductImageDto[];

  @ApiPropertyOptional({
    example: '3d1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
    description:
      'Restrict the reordering to a single product. When omitted the images may belong to different products',
  })
  @IsString()
  @IsOptional()
  productId?: string;
}
