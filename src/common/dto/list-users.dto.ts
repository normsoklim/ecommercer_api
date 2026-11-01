import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';

export enum UserStatusFilter {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'jane',
    description: 'Free text search on email, first name and last name',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description: 'Only return users holding this role',
  })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: UserStatusFilter,
    description: 'Only return users with this account status',
  })
  @IsEnum(UserStatusFilter)
  @IsOptional()
  status?: UserStatusFilter;
}
