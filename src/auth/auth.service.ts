import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerificationService } from './verification.service';
import { PasswordService } from './password.service';
import { parseDurationToMs } from '../common/utils/duration';
import type { Request } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Absolute session lifetime: after this period the session is invalid regardless of activity. */
  private readonly SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /** Idle timeout: after this period of inactivity the session is invalid. */
  private readonly SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private verificationService: VerificationService,
    private passwordService: PasswordService,
  ) {}

  /**
   * Extracts the client IP address from the request, accounting for common
   * reverse-proxy headers (X-Forwarded-For, X-Real-IP).
   */
  private getClientIp(req?: Request): string | undefined {
    if (!req) return undefined;
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const xff = headers['x-forwarded-for'];
    if (xff) {
      const value = Array.isArray(xff) ? xff[0] : xff;
      return value.split(',')[0].trim() || undefined;
    }
    const xri = headers['x-real-ip'];
    if (xri) {
      const value = Array.isArray(xri) ? xri[0] : xri;
      return value.trim() || undefined;
    }
    return (req as any).ip ?? (req as any).connection?.remoteAddress ?? undefined;
  }

  private getUserAgent(req?: Request): string | undefined {
    if (!req) return undefined;
    return req.headers['user-agent'] ?? undefined;
  }

  /**
   * Validates that a session has not exceeded its idle or absolute timeout.
   * Throws UnauthorizedException if the session is expired.
   */
  private async validateSessionTimeout(session: {
    expiresAt: Date;
    lastActivityAt: Date;
  }) {
    const now = new Date();

    // Absolute timeout: session cannot live beyond this regardless of activity.
    const absoluteExpiry = new Date(
      session.lastActivityAt.getTime() + this.SESSION_ABSOLUTE_TIMEOUT_MS,
    );
    if (now > absoluteExpiry) {
      throw new UnauthorizedException('Session has expired');
    }

    // Idle timeout: session becomes invalid after inactivity.
    const idleExpiry = new Date(
      session.lastActivityAt.getTime() + this.SESSION_IDLE_TIMEOUT_MS,
    );
    if (now > idleExpiry) {
      throw new UnauthorizedException('Session has expired due to inactivity');
    }

    // Also enforce the stored expiresAt as a hard ceiling.
    if (now > session.expiresAt) {
      throw new UnauthorizedException('Session has expired');
    }
  }

  /**
   * Updates the lastActivityAt timestamp on a session to keep it alive.
   */
  private async touchSession(sessionId: string) {
    await this.db.query(
      'UPDATE sessions SET "lastActivityAt" = NOW() WHERE id = $1',
      [sessionId],
    );
  }

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    const existingUser = await this.db.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(password);

    const userResult = await this.db.query(
      `INSERT INTO users (email, "passwordHash", "firstName", "lastName", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'PENDING_VERIFICATION', NOW(), NOW())
       RETURNING id, email, "passwordHash", "firstName", "lastName", phone, status, "emailVerified", "createdAt", "updatedAt"`,
      [email, passwordHash, firstName, lastName],
    );

    const user = userResult.rows[0];

    // Assign the default CUSTOMER role. The role is created on the fly so a
    // new account always owns at least one role, even on a fresh database.
    const customerRole = await this.db.query(
      `INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
       VALUES ('CUSTOMER', 'Default role of a registered customer account', true, NOW(), NOW())
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name, description, "isActive", "createdAt", "updatedAt"`,
    );

    let roleRow = customerRole.rows[0];
    if (!roleRow) {
      const existingRole = await this.db.query(
        'SELECT id, name, description, "isActive", "createdAt", "updatedAt" FROM roles WHERE name = $1',
        ['CUSTOMER'],
      );
      roleRow = existingRole.rows[0];
    }

    await this.db.query(
      `INSERT INTO user_roles ("userId", "roleId", "createdAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT ("userId", "roleId") DO NOTHING`,
      [user.id, roleRow.id],
    );

    // Create cart and wishlist for the user
    await this.db.query(
      `INSERT INTO carts ("userId", "createdAt", "updatedAt")
       VALUES ($1, NOW(), NOW())`,
      [user.id],
    );

    await this.db.query(
      `INSERT INTO wishlists ("userId", "createdAt", "updatedAt")
       VALUES ($1, NOW(), NOW())`,
      [user.id],
    );

    // Send the email verification code right after registration. A delivery
    // failure must not roll back the registration, the code can be requested
    // again through POST /auth/email/verification-code.
    try {
      await this.verificationService.issueEmailVerificationCode(user, {
        skipCooldown: true,
      });
    } catch (error) {
      this.logger.error(
        `Unable to send the verification code to ${email}: ${(error as Error).message}`,
      );
    }

    // The account cannot be used until the address is confirmed, so no tokens
    // are issued here. The client sends the customer to the one-time code
    // screen and lets them sign in once the verification succeeded.
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        status: user.status,
        emailVerified: user.emailVerified,
        roles: [roleRow.name],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      requiresVerification: true,
      email: user.email,
      expiresInSeconds: this.verificationService.expiresInMinutes * 60,
    };
  }

  /**
   * Issues a new one-time code for the email verification flow.
   */
  async sendVerificationCode(sendVerificationCodeDto: SendVerificationCodeDto) {
    const user = await this.db.query(
      'SELECT id, email, "emailVerified" FROM users WHERE email = $1',
      [sendVerificationCodeDto.email],
    );

    if (user.rows.length === 0) {
      throw new NotFoundException('User with this email does not exist');
    }

    const userRow = user.rows[0];

    if (userRow.emailVerified) {
      return {
        message: 'This email address is already verified',
        verified: true,
        expiresInSeconds: 0,
      };
    }

    const { expiresAt } =
      await this.verificationService.issueEmailVerificationCode(userRow);

    return {
      message: 'Verification code sent',
      verified: false,
      expiresAt,
      expiresInSeconds: this.verificationService.expiresInMinutes * 60,
    };
  }

  /**
   * Validates the one-time code and marks the email address as verified.
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.db.query(
      'SELECT id, email, status, "emailVerified" FROM users WHERE email = $1',
      [verifyEmailDto.email],
    );

    if (user.rows.length === 0) {
      throw new NotFoundException('User with this email does not exist');
    }

    const userRow = user.rows[0];

    if (userRow.emailVerified) {
      return {
        verified: true,
        email: userRow.email,
        status: userRow.status,
      };
    }

    await this.verificationService.verifyEmailCode(
      userRow.id,
      verifyEmailDto.code,
    );

    await this.db.query(
      `UPDATE users SET "emailVerified" = NOW(), status = $1, "updatedAt" = NOW() WHERE id = $2`,
      [userRow.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : userRow.status, userRow.id],
    );

    return {
      verified: true,
      email: userRow.email,
      status: userRow.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : userRow.status,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const result = await this.db.query(
      `SELECT u.*,
        (SELECT json_agg(r.name) FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id) as role_names
       FROM users u
       WHERE u.email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = result.rows[0];

    const isPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is suspended');
    }

    if (user.status === 'PENDING_VERIFICATION' && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email address before logging in',
      );
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      userRoles: (user.role_names || []).map((name: string) => ({ role: { name } })),
    };
  }

  async login(loginDto: LoginDto, req?: Request) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // "Keep me signed in" asks for long lived tokens, the default flow keeps
    // the short lived ones so a shared device signs out on its own.
    const rememberMe = loginDto.rememberMe === true;
    const accessExpiresIn = this.resolveExpiresIn(
      rememberMe
        ? this.configService.get('JWT_REMEMBER_ME_EXPIRATION', '30d')
        : this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
      '15m',
    );
    const refreshExpiresIn = this.resolveExpiresIn(
      rememberMe
        ? this.configService.get('JWT_REMEMBER_ME_REFRESH_EXPIRATION', '90d')
        : this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      '7d',
    );

    const payload = {
      sub: user.id,
      email: user.email,
      roles: (user.role_names || []),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh', rememberMe },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    // Session fixation protection: revoke all existing sessions for this user
    // before issuing a new one, so a previously fixed session ID cannot be
    // reused after authentication.
    await this.db.query(
      'DELETE FROM sessions WHERE "userId" = $1',
      [user.id],
    );

    // Store session, it expires together with the access token.
    const expiresAt = new Date(Date.now() + accessExpiresIn * 1000);

    await this.db.query(
      `INSERT INTO sessions ("userId", token, "refreshToken", "expiresAt", "lastActivityAt", "ipAddress", "userAgent", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        user.id,
        accessToken,
        refreshToken,
        expiresAt,
        new Date(),
        this.getClientIp(req),
        this.getUserAgent(req),
      ],
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        roles: (user.role_names || []),
      },
      accessToken,
      refreshToken,
      rememberMe,
      expiresInMs: accessExpiresIn * 1000,
      refreshExpiresInMs: refreshExpiresIn * 1000,
    };
  }

  async logoutByRefreshToken(refreshToken: string) {
    await this.db.query(
      'DELETE FROM sessions WHERE "refreshToken" = $1',
      [refreshToken],
    );
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // A remembered session keeps the long lived lifetime when it is renewed.
      const rememberMe = payload.rememberMe === true;
      const accessExpiresIn = this.resolveExpiresIn(
        rememberMe
          ? this.configService.get('JWT_REMEMBER_ME_EXPIRATION', '30d')
          : this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
        '15m',
      );
      const refreshExpiresIn = this.resolveExpiresIn(
        rememberMe
          ? this.configService.get('JWT_REMEMBER_ME_REFRESH_EXPIRATION', '90d')
          : this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
        '7d',
      );

      const numericUserId = Number(payload.sub);
      if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        throw new UnauthorizedException('Invalid user id');
      }
      const user = await this.db.query(
        `SELECT u.*,
          (SELECT json_agg(r.name) FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id) as role_names
         FROM users u
         WHERE u.id = $1`,
        [numericUserId],
      );

      if (!user.rows.length || user.rows[0].status === 'SUSPENDED') {
        throw new UnauthorizedException('Invalid user');
      }

      const userRow = user.rows[0];

      const accessPayload = {
        sub: userRow.id,
        email: userRow.email,
        roles: (userRow.role_names || []),
      };

      const accessToken = this.jwtService.sign(accessPayload, {
        expiresIn: accessExpiresIn,
      });
      const newRefreshToken = this.jwtService.sign(
        { sub: userRow.id, type: 'refresh', rememberMe },
        {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
          expiresIn: refreshExpiresIn,
        },
      );

      const expiresAt = new Date(Date.now() + accessExpiresIn * 1000);

      // Find the session by its refresh token and rotate both tokens.
      const session = await this.db.query(
        'SELECT * FROM sessions WHERE "refreshToken" = $1 LIMIT 1',
        [refreshToken],
      );

      if (session.rows.length === 0) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const sessionRow = session.rows[0];

      // Validate session timeout before rotating tokens.
      await this.validateSessionTimeout(sessionRow);

      // Rotate tokens and refresh the last activity timestamp.
      await this.db.query(
        `UPDATE sessions SET token = $1, "refreshToken" = $2, "expiresAt" = $3, "lastActivityAt" = NOW(), "updatedAt" = NOW() WHERE id = $4`,
        [accessToken, newRefreshToken, expiresAt, sessionRow.id],
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
        rememberMe,
        expiresInMs: accessExpiresIn * 1000,
        refreshExpiresInMs: refreshExpiresIn * 1000,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Converts a duration such as `15m` or `30d` into the number of seconds the
   * token stays valid.
   */
  private resolveExpiresIn(
    value: string | undefined,
    fallback: string,
  ): number {
    return Math.floor(parseDurationToMs(value, fallback) / 1000);
  }

  async logout(token: string) {
    await this.db.query(
      'DELETE FROM sessions WHERE token = $1',
      [token],
    );
  }

  async getProfile(userId: string) {
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      throw new UnauthorizedException('Invalid user id');
    }
    const result = await this.db.query(
      `SELECT u.*,
        (SELECT json_agg(r.name) FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = u.id) as role_names
       FROM users u
       WHERE u.id = $1`,
      [numericUserId],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const user = result.rows[0];
    const { passwordHash, ...resultWithoutPassword } = user;
    return {
      ...resultWithoutPassword,
      userRoles: (user.role_names || []).map((name: string) => ({ role: { name } })),
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.db.query(
      'SELECT id, "passwordHash" FROM users WHERE id = $1',
      [userId],
    );

    if (user.rows.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    if (updateProfileDto.firstName !== undefined) {
      updateFields.push(`"firstName" = $${paramIndex++}`);
      updateValues.push(updateProfileDto.firstName);
    }
    if (updateProfileDto.lastName !== undefined) {
      updateFields.push(`"lastName" = $${paramIndex++}`);
      updateValues.push(updateProfileDto.lastName);
    }
    if (updateProfileDto.phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      updateValues.push(updateProfileDto.phone);
    }

    if (updateFields.length === 0) {
      return this.getProfile(userId);
    }

    updateFields.push(`"updatedAt" = NOW()`);
    updateValues.push(userId);

    const result = await this.db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, "firstName", "lastName", phone, status, "emailVerified", "createdAt", "updatedAt"`,
      updateValues,
    );

    const updatedUser = result.rows[0];

    // Fetch roles
    const rolesResult = await this.db.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE ur."userId" = $1`,
      [userId],
    );

    return {
      ...updatedUser,
      userRoles: rolesResult.rows.map((r: any) => ({ role: { name: r.name } })),
    };
  }
}
