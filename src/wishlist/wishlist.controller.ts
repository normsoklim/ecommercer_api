import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/add-to-wishlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('wishlist')
@ApiBearerAuth('access-token')
@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the wishlist of the authenticated user' })
  @ApiOkResponse({
    description: 'The wishlist with its items',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getWishlist(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlistService.getWishlist(user.sub);
  }

  @Post('add')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a product to the wishlist' })
  @ApiCreatedResponse({
    description: 'The added wishlist item',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  addToWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() addToWishlistDto: AddToWishlistDto,
  ) {
    return this.wishlistService.addToWishlist(user.sub, addToWishlistDto);
  }

  @Delete('item/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  @ApiParam({ name: 'productId', description: 'Product id (UUID)' })
  @ApiOkResponse({
    description: 'The removed wishlist item',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Wishlist item not found' })
  removeFromWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeFromWishlist(user.sub, productId);
  }
}
