import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    example: 'EDITOR',
    minLength: 2,
    maxLength: 50,
    description:
      'New unique role name. It is normalized to upper case, e.g. "editor" -> "EDITOR".',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z][A-Za-z0-9 _-]*$/, {
    message:
      'name must start with a letter and may only contain letters, digits, spaces, underscores or hyphens',
  })
  name?: string;

  @ApiPropertyOptional({
    example: 'Can edit the catalog but not manage users',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
