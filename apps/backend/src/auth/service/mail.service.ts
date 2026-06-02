import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Dev mail transport.
 *
 * Supabase used to send transactional emails (verification / password reset).
 * For local development we don't run an SMTP server — instead the action link
 * is logged to the server console so flows can be completed manually. Swap this
 * out for a real transport (nodemailer + SMTP) in production.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
  }

  sendVerificationEmail(email: string, token: string): void {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    this.logger.log(`[email] Verify ${email}: ${link}`);
  }

  sendPasswordResetEmail(email: string, token: string): void {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    this.logger.log(`[email] Password reset for ${email}: ${link}`);
  }
}
