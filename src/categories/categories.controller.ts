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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoryResponseDto } from '../common/dto/responses.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a category (ADMIN, STAFF)' })
  @ApiCreatedResponse({
    description: 'Category created',
    type: CategoryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all categories' })
  @ApiOkResponse({ description: 'All categories', type: [CategoryResponseDto] })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by id' })
  @ApiParam({ name: 'id', description: 'Category id (UUID)' })
  @ApiOkResponse({ description: 'The category', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a category by slug' })
  @ApiParam({ name: 'slug', description: 'URL friendly category slug' })
  @ApiOkResponse({ description: 'The category', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a category (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Category id (UUID)' })
  @ApiOkResponse({
    description: 'The updated category',
    type: CategoryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a category (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Category id (UUID)' })
  @ApiOkResponse({
    description: 'The deleted category',
    type: CategoryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
