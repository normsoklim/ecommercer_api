import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('addresses')
@ApiBearerAuth('access-token')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Save a delivery address for the authenticated customer',
    description:
      'Stores the formatted address, the delivery coordinates and the Google place id of a selected location.',
  })
  @ApiCreatedResponse({
    description: 'The saved delivery address',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.addressesService.create(user.sub, createAddressDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List the saved delivery addresses of the authenticated customer',
  })
  @ApiOkResponse({
    description: 'The saved delivery addresses',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.addressesService.findAll(user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update a saved delivery address of the authenticated customer',
  })
  @ApiParam({ name: 'id', description: 'Address id (UUID)' })
  @ApiOkResponse({
    description: 'The updated delivery address',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Address not found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressesService.update(user.sub, id, updateAddressDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete a saved delivery address of the authenticated customer',
  })
  @ApiParam({ name: 'id', description: 'Address id (UUID)' })
  @ApiOkResponse({ description: 'The deleted delivery address' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Address not found' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.addressesService.remove(user.sub, id);
  }
}
