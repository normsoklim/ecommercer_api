import {
  Controller,
  Get,
  Post,
  Delete,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from '../common/dto/list-users.dto';
import { AssignRoleToUserDto } from '../roles/dto/assign-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  RoleResponseDto,
  UserResponseDto,
  UserRoleResponseDto,
} from '../common/dto/responses.dto';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the users of the platform (ADMIN, STAFF)' })
  @ApiOkResponse({
    description: 'Users with their roles',
    schema: paginatedResponseSchema({
      type: 'object',
      additionalProperties: true,
    }),
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a user with its roles (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  @ApiOkResponse({ description: 'The user', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the roles of a user (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  @ApiOkResponse({
    description: 'The roles of the user',
    type: [RoleResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN or STAFF role' })
  @ApiNotFoundResponse({ description: 'User not found' })
  findUserRoles(@Param('id') id: string) {
    return this.usersService.findUserRoles(id);
  }

  @Post(':id/roles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign a role to a user (any authenticated user)' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  @ApiCreatedResponse({
    description: 'The role has been assigned to the user',
    type: UserRoleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'User or role not found' })
  assignRole(
    @Param('id') id: string,
    @Body() assignRoleToUserDto: AssignRoleToUserDto,
  ) {
    return this.usersService.assignRole(id, assignRoleToUserDto);
  }

  @Delete(':id/roles/:roleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a role from a user (ADMIN)' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  @ApiParam({ name: 'roleId', description: 'Role id (UUID)' })
  @ApiOkResponse({ description: 'The role has been revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'User, role or assignment not found' })
  removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.usersService.removeRole(id, roleId);
  }
}
