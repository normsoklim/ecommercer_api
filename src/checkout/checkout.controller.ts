import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('checkout')
@ApiBearerAuth('access-token')
@Controller('checkout')
export class CheckoutController {
  constructor(private checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Place an order from the current cart',
    description:
      'Creates the order, stores the shipping address and reserves the stock of every cart item.',
  })
  @ApiCreatedResponse({
    description: 'The created order',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiBadRequestResponse({
    description: 'Empty cart, out of stock or invalid coupon',
  })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCheckoutDto: CreateCheckoutDto,
  ) {
    return this.checkoutService.createCheckout(user.sub, createCheckoutDto);
  }
}
