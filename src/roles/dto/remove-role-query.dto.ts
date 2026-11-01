import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RemoveRoleQueryDto {
  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Delete the role even when users are still assigned to it (the assignments are removed as well)',
  })
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
