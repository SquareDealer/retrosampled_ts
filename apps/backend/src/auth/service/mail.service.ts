import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Transactional email.
 *
 * - With `RESEND_API_KEY` set, sends via the Resend HTTP API (no SDK needed).
 * - Otherwise logs the action link to the server console (dev default).
 *
 * Sending is fire-and-forget: a slow or failing mail provider never blocks the
 * auth request. Failures are logged.
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
    this.dispatch(
      email,
      'Verify your email',
      `Confirm your Retrosamples account: ${link}`,
      `Verify ${email}`,
      link,
    );
  }

  sendPasswordResetEmail(email: string, token: string): void {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    this.dispatch(
      email,
      'Reset your password',
      `Reset your Retrosamples password: ${link}`,
      `Password reset for ${email}`,
      link,
    );
  }

  private dispatch(
    to: string,
    subject: string,
    text: string,
    logLabel: string,
    link: string,
  ): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.log(`[email] ${logLabel}: ${link}`);
      return;
    }

    const from =
      this.config.get<string>('MAIL_FROM') ?? 'Retrosamples <noreply@retrosamples.dev>';

    void fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          this.logger.error(`Failed to send email to ${to}: ${res.status} ${body}`);
        }
      })
      .catch((error) => {
        this.logger.error(`Failed to send email to ${to}: ${error}`);
      });
  }
}
