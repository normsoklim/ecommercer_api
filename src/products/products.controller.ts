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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductResponseDto } from '../common/dto/responses.dto';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a product (ADMIN, STAFF)' })
  @ApiCreatedResponse({
    description: 'Product created',
    type: ProductResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'List products with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Free text search on name, SKU and description',
  })
  @ApiOkResponse({
    description: 'Paginated list of products',
    schema: paginatedResponseSchema({
      $ref: '#/components/schemas/ProductResponseDto',
    }),
  })
  findAll(@Query() query: SearchProductsDto) {
    return this.productsService.findAll(
      query.page ?? 1,
      query.limit ?? 20,
      query.categoryId,
      query.q,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  @ApiParam({ name: 'id', description: 'Product id (UUID)' })
  @ApiOkResponse({ description: 'The product', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  @ApiParam({ name: 'slug', description: 'URL friendly product slug' })
  @ApiOkResponse({ description: 'The product', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a product (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Product id (UUID)' })
  @ApiOkResponse({
    description: 'The updated product',
    type: ProductResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft delete a product (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Product id (UUID)' })
  @ApiOkResponse({
    description: 'The deleted product',
    type: ProductResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
