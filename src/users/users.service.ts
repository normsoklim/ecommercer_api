import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RolesService } from '../roles/roles.service';
import { ListUsersQueryDto } from '../common/dto/list-users.dto';
import { AssignRoleToUserDto } from '../roles/dto/assign-role.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class UsersService {
  constructor(
    private db: DatabaseService,
    private rolesService: RolesService,
  ) {}

  /**
   * Lists the users of the platform together with their roles.
   */
  async findAll(query: ListUsersQueryDto) {
    const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
    const limit = Math.min(
      query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (query.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(query.status);
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      conditions.push(`(email ILIKE $${paramIndex} OR "firstName" ILIKE $${paramIndex} OR "lastName" ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (query.role?.trim()) {
      conditions.push(`EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id AND r.name = $${paramIndex})`);
      values.push(query.role.trim().toUpperCase());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [usersResult, totalResult] = await Promise.all([
      this.db.query(
        `SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u.status, u."emailVerified", u."createdAt", u."updatedAt",
          (SELECT json_agg(r ORDER BY r.name ASC) FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id) as user_roles
         FROM users u
         ${whereClause}
         ORDER BY u."createdAt" DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, skip],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM users u ${whereClause}`,
        values,
      ),
    ]);

    return {
      data: usersResult.rows.map((user: any) => this.toUserWithRoles(user)),
      meta: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count, 10),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count, 10) / limit),
      },
    };
  }

  /**
   * Returns a single user with its roles.
   */
  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u.status, u."emailVerified", u."createdAt", u."updatedAt",
        (SELECT json_agg(r ORDER BY r.name ASC) FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id) as user_roles
       FROM users u
       WHERE u.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return this.toUserWithRoles(result.rows[0]);
  }

  /**
   * Lists the roles of a user.
   */
  async findUserRoles(id: string) {
    return this.rolesService.listUserRoles(id);
  }

  /**
   * Assigns a role to a user, the role is referenced by id or by name.
   */
  async assignRole(id: string, assignRoleToUserDto: AssignRoleToUserDto) {
    if (!assignRoleToUserDto.roleId && !assignRoleToUserDto.roleName) {
      throw new BadRequestException(
        'Either roleId or roleName must be provided',
      );
    }

    return this.rolesService.assignRoleToUser(id, assignRoleToUserDto);
  }

  /**
   * Revokes a role from a user, the role is referenced by id or by name.
   */
  async removeRole(id: string, roleId: string, roleName?: string) {
    if (!roleId && !roleName) {
      throw new BadRequestException(
        'Either roleId or roleName must be provided',
      );
    }

    return this.rolesService.removeRoleFromUser(id, roleId, roleName);
  }

  private toUserWithRoles(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    status: string;
    emailVerified: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user_roles: Array<{
      id: string;
      name: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.user_roles || [],
    };
  }
}
