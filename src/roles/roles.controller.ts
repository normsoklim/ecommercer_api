import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ListUsersQueryDto } from '../common/dto/list-users.dto';
import { RemoveRoleQueryDto } from './dto/remove-role-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  RoleResponseDto,
  UserRoleResponseDto,
} from '../common/dto/responses.dto';
import { paginatedResponseSchema } from '../common/dto/pagination.dto';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all roles (ADMIN, STAFF)' })
  @ApiOkResponse({
    description: 'All roles',
    type: [RoleResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.rolesService.findAll(includeInactive === 'true');
  }

  @Get('name/:name')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a role by name (ADMIN, STAFF)' })
  @ApiParam({ name: 'name', description: 'Role name, case insensitive' })
  @ApiOkResponse({ description: 'The role', type: RoleResponseDto })
  @ApiNotFoundResponse({ description: 'Role not found' })
  findByName(@Param('name') name: string) {
    return this.rolesService.findByName(name);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a role by id (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Role id (UUID)' })
  @ApiOkResponse({ description: 'The role', type: RoleResponseDto })
  @ApiNotFoundResponse({ description: 'Role not found' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Get(':id/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the users holding a role (ADMIN, STAFF)' })
  @ApiParam({ name: 'id', description: 'Role id (UUID)' })
  @ApiOkResponse({
    description: 'Users holding the role',
    schema: paginatedResponseSchema({
      type: 'object',
      additionalProperties: true,
    }),
  })
  @ApiNotFoundResponse({ description: 'Role not found' })
  listRoleUsers(@Param('id') id: string, @Query() query: ListUsersQueryDto) {
    return this.rolesService.listRoleUsers(id, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a role (ADMIN)' })
  @ApiCreatedResponse({
    description: 'Role created',
    type: RoleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiConflictResponse({ description: 'A role with this name already exists' })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Create the default roles ADMIN, STAFF and CUSTOMER (any authenticated user)',
  })
  @ApiCreatedResponse({ description: 'Default roles created' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  seed() {
    return this.rolesService.seedDefaultRoles();
  }

  @Post(':id/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign a role to a user (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Role id (UUID)' })
  @ApiCreatedResponse({
    description: 'The role has been assigned to the user',
    type: UserRoleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Role or user not found' })
  assignUserToRole(
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    return this.rolesService.assignUserToRole(id, assignRoleDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a role (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Role id (UUID)' })
  @ApiOkResponse({ description: 'The updated role', type: RoleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id/users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a role from a user (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Role id (UUID)' })
  @ApiParam({ name: 'userId', description: 'User id (UUID)' })
  @ApiOkResponse({ description: 'The role has been revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Role, user or assignment not found' })
  removeUserFromRole(@Param('id') id: string, @Param('userId') userId: string) {
    return this.rolesService.removeUserFromRole(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a role (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Role id (UUID)' })
  @ApiOkResponse({ description: 'The deleted role', type: RoleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiConflictResponse({
    description:
      'The role is still assigned to users, use force=true to delete it',
  })
  remove(@Param('id') id: string, @Query() query: RemoveRoleQueryDto) {
    return this.rolesService.remove(id, query.force === true);
  }
}
