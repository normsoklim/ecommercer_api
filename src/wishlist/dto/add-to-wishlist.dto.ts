import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToWishlistDto {
  @ApiProperty({ description: 'The id of the product to add to the wishlist' })
  @IsString()
  productId: string;
}
