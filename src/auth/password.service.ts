import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing and verification using Argon2id.
 *
 * Argon2id automatically generates a unique random salt for every password and
 * embeds it in the encoded hash, so no separate salt column is required.
 *
 * The tuning parameters below are a reasonable starting point. Benchmark them
 * on your deployment hardware and adjust to meet your security and latency
 * requirements.
 */
@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
