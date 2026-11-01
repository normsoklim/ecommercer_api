import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * Bucket size used to group the orders of the reporting window into the
 * `salesOverTime` series.
 */
export enum ReportGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class ListReportsDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'First day of the reporting window (ISO 8601 date)',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Last day of the reporting window (ISO 8601 date)',
  })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    enum: ReportGranularity,
    default: ReportGranularity.DAY,
    description: 'Bucket size of the sales over time series',
  })
  @IsEnum(ReportGranularity)
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  granularity?: ReportGranularity;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
    description: 'How many rows the top products / top customers lists hold',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
