import { IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchProductsDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value ?? '1'), 10) || 1)
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value ?? '20'), 10) || 20)
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
