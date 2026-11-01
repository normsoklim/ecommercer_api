import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
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
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('cart')
@ApiBearerAuth('access-token')
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the cart of the authenticated user' })
  @ApiOkResponse({
    description: 'The cart with its items',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user.sub);
  }

  @Post('add')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a product (and optional variant) to the cart' })
  @ApiCreatedResponse({
    description: 'The updated cart',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Product or variant not found' })
  addToCart(
    @CurrentUser() user: AuthenticatedUser,
    @Body() addToCartDto: AddToCartDto,
  ) {
    return this.cartService.addToCart(user.sub, addToCartDto);
  }

  @Patch('item/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update the quantity of a cart item' })
  @ApiParam({ name: 'itemId', description: 'Cart item id (UUID)' })
  @ApiOkResponse({
    description: 'The updated cart',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Cart item not found' })
  updateCartItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(user.sub, itemId, updateCartItemDto);
  }

  @Delete('item/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove a single item from the cart' })
  @ApiParam({ name: 'itemId', description: 'Cart item id (UUID)' })
  @ApiOkResponse({
    description: 'The updated cart',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Cart item not found' })
  removeFromCart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeFromCart(user.sub, itemId);
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove every item from the cart' })
  @ApiOkResponse({ description: 'The emptied cart' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  clearCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.clearCart(user.sub);
  }
}
