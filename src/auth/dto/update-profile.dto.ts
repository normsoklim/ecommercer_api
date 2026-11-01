import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+6612345678', nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;
}
