import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Identifies the user a role should be assigned to. Either `userId` or
 * `userEmail` must be provided.
 */
export class AssignRoleDto {
  @ApiPropertyOptional({
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    format: 'uuid',
    description: 'Id of the user receiving the role',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: 'customer@example.com',
    description: 'Email of the user receiving the role',
  })
  @IsEmail()
  @IsOptional()
  userEmail?: string;

  @ApiPropertyOptional({
    example: 'Role assignment replaces the existing roles of the user',
    default: false,
  })
  @IsOptional()
  replaceExisting?: boolean;
}

/**
 * Identifies the role to assign. Either `roleId` or `roleName` must be
 * provided.
 */
export class AssignRoleToUserDto {
  @ApiPropertyOptional({
    example: '0f0d2a1c-6c1a-4a53-9d1a-2f1d3c4b5a6e',
    format: 'uuid',
    description: 'Id of the role to assign',
  })
  @IsUUID()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description: 'Name of the role to assign (case insensitive)',
  })
  @IsString()
  @IsOptional()
  roleName?: string;
}
