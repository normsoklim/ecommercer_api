import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';

const EMAIL_VERIFICATION = 'EMAIL_VERIFICATION' as const;

export interface VerificationUser {
  id: string;
  email: string;
  firstName?: string | null;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  private readNumber(key: string, fallback: number): number {
    const parsed = parseInt(this.configService.get<string>(key) ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  /** Number of digits of the one-time code. */
  get codeLength(): number {
    return this.readNumber('OTP_LENGTH', 6);
  }

  /** Lifetime of a one-time code, in minutes. */
  get expiresInMinutes(): number {
    return this.readNumber('OTP_EXPIRES_IN_MINUTES', 10);
  }

  /** Maximum number of wrong attempts allowed per code. */
  get maxAttempts(): number {
    return this.readNumber('OTP_MAX_ATTEMPTS', 5);
  }

  /** Minimum delay between two codes sent to the same account, in seconds. */
  get resendCooldownSeconds(): number {
    return this.readNumber('OTP_RESEND_COOLDOWN_SECONDS', 60);
  }

  private generateCode(): string {
    const max = 10 ** this.codeLength;
    return randomInt(0, max).toString().padStart(this.codeLength, '0');
  }

  /**
   * Creates a new one-time code for the given user, invalidates the previous
   * ones and sends the code by email.
   */
  async issueEmailVerificationCode(
    user: VerificationUser,
    options: { skipCooldown?: boolean } = {},
  ): Promise<{ expiresAt: Date }> {
    const latest = await this.db.query(
      `SELECT * FROM verification_codes WHERE "userId" = $1 AND purpose = $2 ORDER BY "createdAt" DESC LIMIT 1`,
      [user.id, EMAIL_VERIFICATION],
    );

    if (latest.rows.length > 0 && !options.skipCooldown) {
      const latestRow = latest.rows[0];
      const elapsedSeconds = (Date.now() - new Date(latestRow.createdAt).getTime()) / 1000;
      if (elapsedSeconds < this.resendCooldownSeconds) {
        const retryAfter = Math.ceil(
          this.resendCooldownSeconds - elapsedSeconds,
        );
        throw new HttpException(
          `Please wait ${retryAfter} second(s) before requesting a new verification code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Only the most recent code stays usable.
    await this.db.query(
      `UPDATE verification_codes SET "consumedAt" = NOW() WHERE "userId" = $1 AND purpose = $2 AND "consumedAt" IS NULL`,
      [user.id, EMAIL_VERIFICATION],
    );

    // Housekeeping: drop codes that can no longer be used.
    await this.db.query(
      'DELETE FROM verification_codes WHERE "expiresAt" < NOW()',
    );

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.expiresInMinutes * 60_000);

    const record = await this.db.query(
      `INSERT INTO verification_codes ("userId", email, purpose, "codeHash", "expiresAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, "userId", email, purpose, "codeHash", "expiresAt", "createdAt", "updatedAt"`,
      [user.id, user.email, EMAIL_VERIFICATION, codeHash, expiresAt],
    );

    try {
      await this.mailService.sendVerificationCode(
        user.email,
        code,
        user.firstName,
        this.expiresInMinutes,
      );
    } catch (error) {
      // The code never reached the user, drop it so a new one can be issued.
      await this.db.query(
        'DELETE FROM verification_codes WHERE id = $1',
        [record.rows[0].id],
      );
      this.logger.error(
        `Unable to deliver the verification code to ${user.email}: ${(error as Error).message}`,
      );
      throw error;
    }

    this.logger.log(
      `Issued a verification code for ${user.email} (expires at ${expiresAt.toISOString()})`,
    );

    return { expiresAt };
  }

  /**
   * Validates a one-time code. Throws a `BadRequestException` when the code is
   * unknown, expired, exhausted or simply wrong.
   */
  async verifyEmailCode(userId: string, code: string): Promise<void> {
    const record = await this.db.query(
      `SELECT * FROM verification_codes WHERE "userId" = $1 AND purpose = $2 AND "consumedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`,
      [userId, EMAIL_VERIFICATION],
    );

    if (record.rows.length === 0) {
      throw new BadRequestException(
        'No verification code was requested for this account. Please request a new code.',
      );
    }

    const recordRow = record.rows[0];

    if (new Date(recordRow.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('The verification code has expired');
    }

    if (recordRow.attempts >= this.maxAttempts) {
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new verification code.',
      );
    }

    const isValid = await bcrypt.compare(code, recordRow.codeHash);

    if (!isValid) {
      await this.db.query(
        `UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1`,
        [recordRow.id],
      );
      throw new BadRequestException('The verification code is incorrect');
    }

    await this.db.query(
      `UPDATE verification_codes SET "consumedAt" = NOW() WHERE id = $1`,
      [recordRow.id],
    );
  }
}
