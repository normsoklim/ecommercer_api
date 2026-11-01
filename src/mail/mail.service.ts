import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Thin wrapper around nodemailer.
 *
 * Configuration is read from the environment, supporting both the `MAIL_*`
 * and the `SMTP_*` naming conventions:
 *   MAIL_HOST / SMTP_HOST, MAIL_PORT / SMTP_PORT, MAIL_USERNAME / SMTP_USER,
 *   MAIL_PASSWORD / SMTP_PASS, MAIL_FROM_ADDRESS / SMTP_FROM.
 *
 * The `MAIL_*` variables take precedence when both are present.
 *
 * When no SMTP host is configured the service degrades gracefully: messages are
 * written to the application log instead of being delivered, which keeps local
 * development usable without a mail server.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private captureOnly = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.transporter = this.createTransport();
  }

  private read(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<string>(key);
      if (value !== undefined && value !== null && value.trim() !== '') {
        return value.trim();
      }
    }
    return undefined;
  }

  private createTransport(): Transporter | null {
    const transport = this.read('MAIL_TRANSPORT');

    if (transport === 'json' || transport === 'memory') {
      this.captureOnly = true;
      this.logger.log(
        'Mail transport set to "json" — messages are not delivered.',
      );
      return nodemailer.createTransport({ jsonTransport: true });
    }

    const host = this.read('MAIL_HOST', 'SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'No SMTP host configured (MAIL_HOST / SMTP_HOST). Emails will only be logged to the console.',
      );
      return null;
    }

    const port = Number(this.read('MAIL_PORT', 'SMTP_PORT') ?? '587');
    const user = this.read('MAIL_USERNAME', 'MAIL_USER', 'SMTP_USER');
    const pass = this.read('MAIL_PASSWORD', 'SMTP_PASS');
    const secure =
      this.read('MAIL_SECURE') === 'true' ||
      this.read('SMTP_SECURE') === 'true' ||
      port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private get from(): string {
    const address =
      this.read('MAIL_FROM_ADDRESS', 'SMTP_FROM', 'MAIL_USER') ??
      'no-reply@example.com';
    const name = this.read('MAIL_FROM_NAME', 'SMTP_FROM_NAME');
    return name ? `"${name}" <${address}>` : address;
  }

  /** Sends a message. Returns false when no transport is available. */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `[mail] "${message.subject}" for ${message.to} was not sent (no SMTP transport configured).\n${message.text}`,
      );
      return false;
    }

    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (this.captureOnly) {
      this.logger.log(
        `[mail] captured "${message.subject}" for ${message.to}: ${JSON.stringify(info)}`,
      );
    } else {
      this.logger.log(`[mail] "${message.subject}" sent to ${message.to}`);
    }

    return true;
  }

  /** Sends the one-time password used to verify an email address. */
  async sendVerificationCode(
    to: string,
    code: string,
    firstName?: string | null,
    expiresInMinutes = 10,
  ): Promise<boolean> {
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

    const text = [
      greeting,
      '',
      `Your email verification code is: ${code}`,
      '',
      `The code expires in ${expiresInMinutes} minutes and can only be used once.`,
      'If you did not request this code you can safely ignore this email.',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #111827;">
        <p>${greeting}</p>
        <p>Your email verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">
          ${code}
        </p>
        <p>The code expires in ${expiresInMinutes} minutes and can only be used once.</p>
        <p style="color: #6b7280; font-size: 13px;">
          If you did not request this code you can safely ignore this email.
        </p>
      </div>
    `;

    return this.send({
      to,
      subject: 'Your email verification code',
      text,
      html,
    });
  }
}
