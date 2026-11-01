import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'New quantity, 0 removes the item',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;
}
