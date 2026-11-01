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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReviewResponseDto } from '../common/dto/responses.dto';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'List reviews with pagination and filters',
    description:
      'Only the active reviews are returned. The ADMIN and STAFF members additionally see the hidden ones and can filter on their visibility.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'rating', required: false, type: Number, example: 5 })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiOkResponse({
    description: 'Paginated list of reviews',
    schema: paginatedResponseSchema({
      $ref: '#/components/schemas/ReviewResponseDto',
    }),
  })
  findAll(
    @Query() query: ListReviewsDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.reviewsService.findAll(query, this.isPrivileged(user));
  }

  @Get('product/:productId')
  @ApiOperation({
    summary: 'Get the reviews of a product with its rating summary',
  })
  @ApiParam({ name: 'productId', description: 'Product id (UUID)' })
  @ApiOkResponse({
    description: 'The reviews of the product and their rating summary',
    schema: paginatedResponseSchema({
      $ref: '#/components/schemas/ReviewResponseDto',
    }),
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a review by id' })
  @ApiParam({ name: 'id', description: 'Review id (UUID)' })
  @ApiOkResponse({ description: 'The review', type: ReviewResponseDto })
  @ApiNotFoundResponse({ description: 'Review not found' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Review a product' })
  @ApiCreatedResponse({
    description: 'Review created',
    type: ReviewResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.sub, createReviewDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update a review',
    description:
      'The author can edit the content of their own review, an ADMIN or STAFF member can edit any review and change its visibility.',
  })
  @ApiParam({ name: 'id', description: 'Review id (UUID)' })
  @ApiOkResponse({ description: 'The updated review', type: ReviewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not allowed to update this review' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.update(
      id,
      updateReviewDto,
      user.sub,
      this.isPrivileged(user),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a review',
    description:
      'The author can delete their own review, an ADMIN or STAFF member can delete any review.',
  })
  @ApiParam({ name: 'id', description: 'Review id (UUID)' })
  @ApiOkResponse({ description: 'The deleted review', type: ReviewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not allowed to delete this review' })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.remove(id, user.sub, this.isPrivileged(user));
  }

  /**
   * The ADMIN and STAFF members have the elevated privileges on the reviews.
   */
  private isPrivileged(user?: AuthenticatedUser): boolean {
    const roles = user?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('STAFF');
  }
}
