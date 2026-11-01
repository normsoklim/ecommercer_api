import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List orders',
    description:
      'Customers only see their own orders, admins and staff see every order.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    example: 'PENDING',
  })
  @ApiOkResponse({
    description: 'Paginated list of orders',
    schema: paginatedResponseSchema({
      type: 'object',
      additionalProperties: true,
    }),
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    // Customers can only see their own orders, admins/staff can see all
    const userId =
      (user.roles ?? []).includes('ADMIN') ||
      (user.roles ?? []).includes('STAFF')
        ? undefined
        : user.sub;

    return this.ordersService.findAll(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
      userId,
      status,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get an order by id' })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  @ApiOkResponse({
    description: 'The order',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin =
      (user.roles ?? []).includes('ADMIN') ||
      (user.roles ?? []).includes('STAFF');
    return this.ordersService.findOne(id, isAdmin ? undefined : user.sub);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update the status of an order (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  @ApiOkResponse({
    description: 'The updated order',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel one of your orders' })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  @ApiCreatedResponse({
    description: 'The cancelled order',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({
    description: 'Order not found or the order cannot be cancelled',
  })
  cancelOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.cancelOrder(id, user.sub);
  }
}
