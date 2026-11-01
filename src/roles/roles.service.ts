import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto, AssignRoleToUserDto } from './dto/assign-role.dto';
import { ListUsersQueryDto } from '../common/dto/list-users.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Roles that always exist in the platform. They are created on demand by
 * `seedDefaultRoles()` and are the roles referenced by the `@Roles()`
 * decorator of the existing endpoints.
 */
export const DEFAULT_ROLES = [
  {
    name: 'ADMIN',
    description: 'Full access to the administration panel',
  },
  {
    name: 'STAFF',
    description: 'Can manage the catalog, orders and inventory',
  },
  {
    name: 'CUSTOMER',
    description: 'Default role of a registered customer account',
  },
] as const;

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(private db: DatabaseService) {}

  /**
   * Makes sure the default roles exist as soon as the API starts, so the
   * `@Roles()` decorator of the existing endpoints always matches a role.
   */
  async onModuleInit() {
    try {
      const { created } = await this.seedDefaultRoles();

      if (created.length > 0) {
        this.logger.log(`Default roles created: ${created.join(', ')}`);
      }
    } catch (error) {
      this.logger.warn(
        `Unable to seed the default roles: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Creates a new role. Role names are unique and normalized to upper case.
   */
  async create(createRoleDto: CreateRoleDto) {
    const name = this.normalizeRoleName(createRoleDto.name);

    await this.assertRoleNameIsAvailable(name);

    const result = await this.db.query(
      `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, name, description, "isActive", "createdAt", "updatedAt"`,
      [name, createRoleDto.description, createRoleDto.isActive],
    );

    const role = result.rows[0];

    // Fetch user count
    const countResult = await this.db.query(
      'SELECT COUNT(*) FROM user_roles WHERE "roleId" = $1',
      [role.id],
    );

    return {
      ...role,
      _count: { userRoles: parseInt(countResult.rows[0].count, 10) },
    };
  }

  /**
   * Lists every role. Inactive roles are only returned when explicitly asked.
   */
  async findAll(includeInactive = false) {
    const conditions = includeInactive ? [] : ['"isActive" = true'];
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur."roleId" = r.id) as user_roles_count
       FROM roles r
       ${whereClause}
       ORDER BY r.name ASC`,
    );

    return result.rows.map((row: any) => ({
      ...row,
      _count: { userRoles: parseInt(row.user_roles_count, 10) },
    }));
  }

  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur."roleId" = r.id) as user_roles_count
       FROM roles r
       WHERE r.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const role = result.rows[0];

    // Fetch user roles with user details
    const userRolesResult = await this.db.query(
      `SELECT ur.id, ur."userId", ur."roleId", ur."createdAt",
        u.id, u.email, u."firstName", u."lastName", u.status
       FROM user_roles ur
       JOIN users u ON u.id = ur."userId"
       WHERE ur."roleId" = $1
       ORDER BY ur."createdAt" ASC`,
      [id],
    );

    return {
      ...role,
      _count: { userRoles: parseInt(role.user_roles_count, 10) },
      userRoles: userRolesResult.rows.map((ur: any) => ({
        id: ur.id,
        userId: ur.userId,
        roleId: ur.roleId,
        createdAt: ur.createdAt,
        user: {
          id: ur.id,
          email: ur.email,
          firstName: ur.firstName,
          lastName: ur.lastName,
          status: ur.status,
        },
      })),
    };
  }

  async findByName(name: string) {
    const result = await this.db.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur."roleId" = r.id) as user_roles_count
       FROM roles r
       WHERE r.name = $1`,
      [this.normalizeRoleName(name)],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    return result.rows[0];
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const existing = await this.db.query(
      'SELECT id, name FROM roles WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (updateRoleDto.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(updateRoleDto.description);
    }
    if (updateRoleDto.isActive !== undefined) {
      updateFields.push(`"isActive" = $${paramIndex++}`);
      updateValues.push(updateRoleDto.isActive);
    }

    if (updateRoleDto.name) {
      const name = this.normalizeRoleName(updateRoleDto.name);

      if (name !== existing.rows[0].name) {
        await this.assertRoleNameIsAvailable(name, id);
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(name);
      }
    }

    if (updateFields.length === 0) {
      return this.findOne(id);
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(id);

    const result = await this.db.query(
      `UPDATE roles SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, description, "isActive", "createdAt", "updatedAt"`,
      updateValues,
    );

    const role = result.rows[0];

    // Fetch user count
    const countResult = await this.db.query(
      'SELECT COUNT(*) FROM user_roles WHERE "roleId" = $1',
      [role.id],
    );

    return {
      ...role,
      _count: { userRoles: parseInt(countResult.rows[0].count, 10) },
    };
  }

  /**
   * Deletes a role. Roles that are still assigned to users are only removed
   * when `force` is enabled, otherwise the assignments are removed first.
   */
  async remove(id: string, force = false) {
    const existing = await this.db.query(
      `SELECT r.id, r.name,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur."roleId" = r.id) as user_roles_count
       FROM roles r
       WHERE r.id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    if (parseInt(existing.rows[0].user_roles_count, 10) > 0 && !force) {
      throw new ConflictException(
        `Cannot delete a role that is assigned to ${existing.rows[0].user_roles_count} user(s), revoke the assignments first or use force=true`,
      );
    }

    if (force) {
      await this.db.query('DELETE FROM user_roles WHERE "roleId" = $1', [id]);
    }

    await this.db.query('DELETE FROM roles WHERE id = $1', [id]);

    return { id };
  }

  /**
   * Assigns a role to a user. The operation is idempotent: assigning a role
   * the user already holds returns the existing assignment.
   */
  async assignUserToRole(roleId: string, assignRoleDto: AssignRoleDto) {
    const role = await this.db.query(
      'SELECT id FROM roles WHERE id = $1',
      [roleId],
    );

    if (role.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const user = await this.findTargetUser(assignRoleDto);

    if (assignRoleDto.replaceExisting) {
      await this.db.query('DELETE FROM user_roles WHERE "userId" = $1', [
        user.id,
      ]);
    }

    const existingAssignment = await this.db.query(
      'SELECT id FROM user_roles WHERE "userId" = $1 AND "roleId" = $2',
      [user.id, roleId],
    );

    if (existingAssignment.rows.length > 0) {
      const assignment = existingAssignment.rows[0];
      // Fetch with role and user details
      const detailResult = await this.db.query(
        `SELECT ur.id, ur."userId", ur."roleId", ur."createdAt",
          r.id as role_id, r.name as role_name, r.description as role_description, r."isActive" as role_is_active,
          u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name, u.status as user_status
         FROM user_roles ur
         JOIN roles r ON r.id = ur."roleId"
         JOIN users u ON u.id = ur."userId"
         WHERE ur.id = $1`,
        [assignment.id],
      );
      return detailResult.rows[0];
    }

    const result = await this.db.query(
      `INSERT INTO user_roles ("userId", "roleId", "createdAt")
       VALUES ($1, $2, NOW())
       RETURNING id, "userId", "roleId", "createdAt"`,
      [user.id, roleId],
    );

    const assignment = result.rows[0];

    // Fetch with role and user details
    const detailResult = await this.db.query(
      `SELECT ur.id, ur."userId", ur."roleId", ur."createdAt",
        r.id as role_id, r.name as role_name, r.description as role_description, r."isActive" as role_is_active,
        u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name, u.status as user_status
       FROM user_roles ur
       JOIN roles r ON r.id = ur."roleId"
       JOIN users u ON u.id = ur."userId"
       WHERE ur.id = $1`,
      [assignment.id],
    );

    return detailResult.rows[0];
  }

  /**
   * Revokes a role from a user.
   */
  async removeUserFromRole(roleId: string, userId: string) {
    const role = await this.db.query(
      'SELECT id FROM roles WHERE id = $1',
      [roleId],
    );

    if (role.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const assignment = await this.db.query(
      'SELECT id FROM user_roles WHERE "userId" = $1 AND "roleId" = $2',
      [userId, roleId],
    );

    if (assignment.rows.length === 0) {
      throw new NotFoundException('The user does not have this role');
    }

    await this.assertNotLastAdmin(roleId);

    await this.db.query(
      'DELETE FROM user_roles WHERE id = $1',
      [assignment.rows[0].id],
    );

    return { id: assignment.rows[0].id };
  }

  /**
   * Lists the users holding a role.
   */
  async listRoleUsers(roleId: string, query: ListUsersQueryDto) {
    const role = await this.db.query(
      'SELECT id FROM roles WHERE id = $1',
      [roleId],
    );

    if (role.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const { page, limit, skip, take } = this.paginate(query);

    const [usersResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u.status, u."emailVerified", u."createdAt", u."updatedAt"
         FROM users u
         JOIN user_roles ur ON ur."userId" = u.id
         WHERE ur."roleId" = $1
         ORDER BY u."createdAt" DESC
         LIMIT $2 OFFSET $3`,
        [roleId, limit, skip],
      ),
      this.db.query(
        'SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur."userId" = u.id WHERE ur."roleId" = $1',
        [roleId],
      ),
    ]);

    return {
      data: usersResult.rows,
      meta: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count, 10),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count, 10) / limit),
      },
    };
  }

  /**
   * Lists the roles of a user.
   */
  async listUserRoles(userId: string) {
    const user = await this.db.query(
      `SELECT u.id, u.email, u."firstName", u."lastName", u.status,
        (SELECT json_agg(r ORDER BY r.name ASC) FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id) as roles
       FROM users u
       WHERE u.id = $1`,
      [userId],
    );

    if (user.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.rows[0].id,
      email: user.rows[0].email,
      firstName: user.rows[0].firstName,
      lastName: user.rows[0].lastName,
      status: user.rows[0].status,
      roles: user.rows[0].roles || [],
    };
  }

  /**
   * Assigns a role to a user, the role is referenced by id or by name.
   */
  async assignRoleToUser(
    userId: string,
    assignRoleToUserDto: AssignRoleToUserDto,
  ) {
    const { roleId, roleName } = assignRoleToUserDto;

    if (!roleId && !roleName) {
      throw new BadRequestException(
        'Either roleId or roleName must be provided',
      );
    }

    const user = await this.db.query(
      'SELECT id FROM users WHERE id = $1',
      [userId],
    );

    if (user.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const role = roleId
      ? await this.db.query('SELECT id FROM roles WHERE id = $1', [roleId])
      : await this.db.query(
          'SELECT id FROM roles WHERE name = $1',
          [this.normalizeRoleName(roleName as string)],
        );

    if (role.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const existingAssignment = await this.db.query(
      'SELECT id FROM user_roles WHERE "userId" = $1 AND "roleId" = $2',
      [userId, role.rows[0].id],
    );

    if (existingAssignment.rows.length > 0) {
      const assignment = existingAssignment.rows[0];
      const detailResult = await this.db.query(
        `SELECT ur.id, ur."userId", ur."roleId", ur."createdAt",
          r.id as role_id, r.name as role_name, r.description as role_description, r."isActive" as role_is_active,
          u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name, u.status as user_status
         FROM user_roles ur
         JOIN roles r ON r.id = ur."roleId"
         JOIN users u ON u.id = ur."userId"
         WHERE ur.id = $1`,
        [assignment.id],
      );
      return detailResult.rows[0];
    }

    const result = await this.db.query(
      `INSERT INTO user_roles ("userId", "roleId", "createdAt")
       VALUES ($1, $2, NOW())
       RETURNING id, "userId", "roleId", "createdAt"`,
      [userId, role.rows[0].id],
    );

    const assignment = result.rows[0];

    const detailResult = await this.db.query(
      `SELECT ur.id, ur."userId", ur."roleId", ur."createdAt",
        r.id as role_id, r.name as role_name, r.description as role_description, r."isActive" as role_is_active,
        u.id as user_id, u.email as user_email, u."firstName" as user_first_name, u."lastName" as user_last_name, u.status as user_status
       FROM user_roles ur
       JOIN roles r ON r.id = ur."roleId"
       JOIN users u ON u.id = ur."userId"
       WHERE ur.id = $1`,
      [assignment.id],
    );

    return detailResult.rows[0];
  }

  /**
   * Revokes a role from a user, the role is referenced by id or by name.
   */
  async removeRoleFromUser(userId: string, roleId: string, roleName?: string) {
    const role = roleId
      ? await this.db.query('SELECT id FROM roles WHERE id = $1', [roleId])
      : await this.db.query(
          'SELECT id FROM roles WHERE name = $1',
          [this.normalizeRoleName(roleName as string)],
        );

    if (role.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    return this.removeUserFromRole(role.rows[0].id, userId);
  }

  /**
   * Creates the default roles (ADMIN, STAFF, CUSTOMER) if they are missing.
   * The operation is idempotent and safe to call on every deployment.
   */
  async seedDefaultRoles() {
    const created: string[] = [];
    const existing: string[] = [];

    for (const role of DEFAULT_ROLES) {
      const found = await this.db.query(
        'SELECT id FROM roles WHERE name = $1',
        [role.name],
      );

      if (found.rows.length > 0) {
        existing.push(role.name);
        continue;
      }

      await this.db.query(
        `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())`,
        [role.name, role.description],
      );
      created.push(role.name);
    }

    return { created, existing };
  }

  private async findTargetUser(assignRoleDto: AssignRoleDto) {
    const { userId, userEmail } = assignRoleDto;

    if (!userId && !userEmail) {
      throw new BadRequestException(
        'Either userId or userEmail must be provided',
      );
    }

    const user = userId
      ? await this.db.query('SELECT id FROM users WHERE id = $1', [userId])
      : await this.db.query(
          'SELECT id FROM users WHERE email = $1',
          [(userEmail as string).toLowerCase()],
        );

    if (user.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return user.rows[0];
  }

  /**
   * The last administrator must keep its role, otherwise nobody would be
   * able to manage the platform anymore.
   */
  private async assertNotLastAdmin(roleId: string) {
    const role = await this.db.query(
      'SELECT name FROM roles WHERE id = $1',
      [roleId],
    );

    if (role.rows.length === 0 || role.rows[0].name !== 'ADMIN') {
      return;
    }

    const adminRole = await this.db.query(
      'SELECT id FROM roles WHERE name = $1',
      ['ADMIN'],
    );

    if (adminRole.rows.length === 0) {
      return;
    }

    const adminCount = await this.db.query(
      'SELECT COUNT(*) FROM user_roles WHERE "roleId" = $1',
      [adminRole.rows[0].id],
    );

    if (parseInt(adminCount.rows[0].count, 10) <= 1) {
      throw new ConflictException(
        'Cannot revoke the role of the last administrator',
      );
    }
  }

  private async assertRoleNameIsAvailable(name: string, currentId?: string) {
    const result = currentId
      ? await this.db.query(
          'SELECT id FROM roles WHERE name = $1 AND id != $2',
          [name, currentId],
        )
      : await this.db.query('SELECT id FROM roles WHERE name = $1', [name]);

    if (result.rows.length > 0) {
      throw new ConflictException(`Role "${name}" already exists`);
    }
  }

  private paginate(query: ListUsersQueryDto) {
    const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
    const limit = Math.min(
      query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    return { page, limit, skip: (page - 1) * limit, take: limit };
  }

  private normalizeRoleName(name: string): string {
    return name.trim().toUpperCase().replace(/\s+/g, '_');
  }
}
