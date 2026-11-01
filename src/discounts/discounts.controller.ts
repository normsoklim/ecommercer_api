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
  ApiTags,
  ApiUnauthorizedResponse,
  ApiQuery,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { ListDiscountsDto } from './dto/list-discounts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DiscountResponseDto } from '../common/dto/responses.dto';

@ApiTags('discounts')
@Controller('discounts')
export class DiscountsController {
  constructor(private discountsService: DiscountsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a discount (ADMIN, STAFF)' })
  @ApiCreatedResponse({
    description: 'Discount created',
    type: DiscountResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid discount payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiConflictResponse({ description: 'The discount code is already taken' })
  create(@Body() createDiscountDto: CreateDiscountDto) {
    return this.discountsService.create(createDiscountDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all discounts (ADMIN, STAFF)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOkResponse({ description: 'All discounts', type: [DiscountResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  findAll(@Query() query: ListDiscountsDto) {
    return this.discountsService.findAll(query);
  }

  @Get('available')
  @ApiOperation({ summary: 'List available discounts for customers' })
  @ApiOkResponse({ description: 'Available discounts', type: [DiscountResponseDto] })
  findAvailable() {
    return this.discountsService.findAvailable();
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get a discount by code' })
  @ApiParam({ name: 'code', description: 'Discount code' })
  @ApiOkResponse({ description: 'The discount', type: DiscountResponseDto })
  @ApiNotFoundResponse({ description: 'Discount not found' })
  findByCode(@Param('code') code: string) {
    return this.discountsService.findByCode(code);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a discount by id (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Discount id (UUID)' })
  @ApiOkResponse({ description: 'The discount', type: DiscountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Discount not found' })
  findOne(@Param('id') id: string) {
    return this.discountsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a discount (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Discount id (UUID)' })
  @ApiOkResponse({
    description: 'The updated discount',
    type: DiscountResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid discount payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'Discount not found' })
  @ApiConflictResponse({ description: 'The discount code is already taken' })
  update(
    @Param('id') id: string,
    @Body() updateDiscountDto: UpdateDiscountDto,
  ) {
    return this.discountsService.update(id, updateDiscountDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a discount (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Discount id (UUID)' })
  @ApiOkResponse({
    description: 'The deleted discount',
    type: DiscountResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Discount not found' })
  remove(@Param('id') id: string) {
    return this.discountsService.remove(id);
  }
}
