import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
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
import { ProductImagesService } from './product-images.service';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { ListProductImagesQueryDto } from './dto/list-product-images.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductImageResponseDto } from '../common/dto/responses.dto';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';

@ApiTags('product-images')
@Controller('product-images')
export class ProductImagesController {
  constructor(private productImagesService: ProductImagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Attach an image to a product (ADMIN, STAFF)' })
  @ApiCreatedResponse({
    description: 'Product image created',
    type: ProductImageResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  create(@Body() createProductImageDto: CreateProductImageDto) {
    return this.productImagesService.create(createProductImageDto);
  }

  @Get()
  @ApiOperation({ summary: 'List product images with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'isPrimary', required: false, type: Boolean })
  @ApiOkResponse({
    description: 'Paginated list of product images',
    schema: paginatedResponseSchema({
      $ref: '#/components/schemas/ProductImageResponseDto',
    }),
  })
  findAll(@Query() query: ListProductImagesQueryDto) {
    return this.productImagesService.findAll(
      query.page,
      query.limit,
      query.productId,
      query.isPrimary,
    );
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get all the images of a product' })
  @ApiParam({ name: 'productId', description: 'Product id (UUID)' })
  @ApiOkResponse({
    description: 'The images of the product',
    type: [ProductImageResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findByProduct(@Param('productId') productId: string) {
    return this.productImagesService.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product image by id' })
  @ApiParam({ name: 'id', description: 'Product image id (UUID)' })
  @ApiOkResponse({
    description: 'The product image',
    type: ProductImageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product image not found' })
  findOne(@Param('id') id: string) {
    return this.productImagesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a product image (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Product image id (UUID)' })
  @ApiOkResponse({
    description: 'The updated product image',
    type: ProductImageResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Product image not found' })
  update(
    @Param('id') id: string,
    @Body() updateProductImageDto: UpdateProductImageDto,
  ) {
    return this.productImagesService.update(id, updateProductImageDto);
  }

  @Patch(':id/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set a product image as the primary one (ADMIN, STAFF)',
  })
  @ApiParam({ name: 'id', description: 'Product image id (UUID)' })
  @ApiOkResponse({
    description: 'The promoted product image',
    type: ProductImageResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Product image not found' })
  setPrimary(@Param('id') id: string) {
    return this.productImagesService.setPrimary(id);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reorder the images of a product (ADMIN, STAFF)' })
  @ApiOkResponse({
    description: 'The reordered product images',
    type: [ProductImageResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({
    description: 'One or more product images do not exist',
  })
  reorder(@Body() reorderProductImagesDto: ReorderProductImagesDto) {
    return this.productImagesService.reorder(reorderProductImagesDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a product image (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Product image id (UUID)' })
  @ApiOkResponse({
    description: 'The deleted product image',
    type: ProductImageResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Product image not found' })
  remove(@Param('id') id: string) {
    return this.productImagesService.remove(id);
  }

  @Delete('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete all the images of a product (ADMIN)' })
  @ApiParam({ name: 'productId', description: 'Product id (UUID)' })
  @ApiOkResponse({ description: 'Number of deleted images' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  removeAllByProduct(@Param('productId') productId: string) {
    return this.productImagesService.removeAllByProduct(productId);
  }
}
