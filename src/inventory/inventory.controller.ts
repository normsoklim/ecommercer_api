import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
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
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { StockQuantityDto } from './dto/stock-quantity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('product/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the stock level of a product or variant' })
  @ApiParam({ name: 'productId', description: 'Product id (UUID)' })
  @ApiQuery({ name: 'variantId', required: false, type: String })
  @ApiOkResponse({
    description: 'The inventory record',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'No inventory record for this product' })
  getInventory(
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.inventoryService.getInventory(productId, variantId);
  }

  @Post('adjust')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Adjust the stock level of a product',
  })
  @ApiCreatedResponse({
    description: 'The updated inventory record',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'No inventory record for this product' })
  adjustInventory(@Body() adjustInventoryDto: AdjustInventoryDto) {
    return this.inventoryService.adjustInventory(adjustInventoryDto);
  }

  @Post('reserve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reserve stock for an order' })
  @ApiCreatedResponse({
    description: 'The updated inventory record',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({
    description: 'No inventory record or not enough stock',
  })
  reserveStock(@Body() stockQuantityDto: StockQuantityDto) {
    return this.inventoryService.reserveStock(
      stockQuantityDto.productId,
      stockQuantityDto.variantId,
      stockQuantityDto.quantity,
      stockQuantityDto.orderId,
    );
  }

  @Post('release')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Release reserved stock back to the available quantity',
  })
  @ApiCreatedResponse({
    description: 'The updated inventory record',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'No inventory record for this product' })
  releaseStock(@Body() stockQuantityDto: StockQuantityDto) {
    return this.inventoryService.releaseStock(
      stockQuantityDto.productId,
      stockQuantityDto.variantId,
      stockQuantityDto.quantity,
      stockQuantityDto.orderId,
    );
  }

  @Post('confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({
    summary:
      'Confirm reserved stock and remove it from the available quantity (ADMIN, STAFF)',
  })
  @ApiCreatedResponse({
    description: 'The updated inventory record',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({
    description: 'No inventory record or not enough stock',
  })
  confirmStock(@Body() stockQuantityDto: StockQuantityDto) {
    return this.inventoryService.confirmStock(
      stockQuantityDto.productId,
      stockQuantityDto.variantId,
      stockQuantityDto.quantity,
      stockQuantityDto.orderId,
    );
  }
}
