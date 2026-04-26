import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { EnvService } from '../../infra/config/env.service';

export interface SendProfileEmailInput {
  email: string;
  url: string;
  countryName?: string;
  skillCount?: number;
}

export interface SendProfileEmailResult {
  sent: boolean;
  provider: 'smtp' | 'none';
  id?: string;
  error?: string;
  reason?: string;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Port of apps/web/app/api/email-link/route.ts. Sends the portable profile
 * URL via SMTP. Falls back to {sent:false, provider:'none'} when SMTP env
 * is unconfigured so the client can offer a `mailto:` fallback.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | null;

  constructor(env: EnvService) {
    const host = env.get('SMTP_HOST');
    const port = env.get('SMTP_PORT');
    const user = env.get('SMTP_USER');
    const pass = env.get('SMTP_PASS');
    const secureRaw = env.get('SMTP_SECURE');
    if (!host || !port || !user || !pass) {
      this.logger.log(
        'SMTP env vars not set — /notifications/email-profile will return a mailto: fallback.',
      );
      this.transporter = null;
      this.fromAddress = null;
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secureRaw ?? port === 465,
      auth: { user, pass },
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
    });
    const customFrom = env.get('SMTP_FROM');
    this.fromAddress = customFrom ?? `Cartographer <${user}>`;
  }

  async sendProfileLink(
    input: SendProfileEmailInput,
  ): Promise<SendProfileEmailResult> {
    if (!input.email || !EMAIL_RX.test(input.email))
      return { sent: false, provider: 'none', error: 'Invalid email' };
    if (!input.url || !/^https?:\/\//.test(input.url))
      return { sent: false, provider: 'none', error: 'Invalid url' };
    if (input.url.length > 8000)
      return { sent: false, provider: 'none', error: 'url too large' };

    if (!this.transporter || !this.fromAddress) {
      return {
        sent: false,
        provider: 'none',
        reason:
          'SMTP_HOST/PORT/USER/PASS not configured. Use the mailto fallback.',
      };
    }

    const subject = `Your Cartographer skills profile${
      input.countryName ? ' - ' + input.countryName : ''
    }`;
    const text = [
      'Here is the link to your portable Cartographer skills profile.',
      'Open it on any device. Edit any time and re-share a fresh link.',
      '',
      input.url,
      '',
      input.skillCount
        ? `${input.skillCount} ESCO-grounded skills, mapped from your own description.`
        : '',
      '',
      'Cartographer is open infrastructure. Your profile lives in the URL itself.',
      'Nothing about you is stored on our servers.',
    ]
      .filter(Boolean)
      .join('\n');

    const html = this.renderHtml(subject, input);

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.email,
        subject,
        text,
        html,
      });
      return { sent: true, provider: 'smtp', id: info.messageId };
    } catch (err: any) {
      return {
        sent: false,
        provider: 'smtp',
        error: err?.message ?? 'Unknown SMTP error',
      };
    }
  }

  private renderHtml(subject: string, input: SendProfileEmailInput): string {
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;background:#fafafa;color:#0a0a0a;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;">
    <div style="background:#0369a1;color:#fff;padding:20px 24px;">
      <div style="font-weight:700;letter-spacing:0.04em;font-size:18px;">Cartographer</div>
      <div style="opacity:0.9;font-size:12px;margin-top:4px;">Open Skills Infrastructure</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px 0;font-size:15px;">Your portable skills profile is ready.</p>
      ${
        input.skillCount
          ? `<p style="margin:0 0 16px 0;font-size:13px;color:#525252;">${input.skillCount} ESCO-grounded skills${
              input.countryName ? `, mapped for ${esc(input.countryName)}` : ''
            }.</p>`
          : ''
      }
      <p style="margin:0 0 20px 0;">
        <a href="${esc(input.url)}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Open my profile</a>
      </p>
      <p style="margin:0 0 8px 0;font-size:11px;color:#737373;">If the button does not open, paste this link in your browser:</p>
      <p style="margin:0;word-break:break-all;font-size:11px;color:#404040;">${esc(input.url)}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
      <p style="margin:0;font-size:11px;color:#737373;">
        Your profile lives entirely inside this URL. Nothing about you is stored on Cartographer servers. Edit any time and re-share a fresh link.
      </p>
    </div>
  </div>
</body></html>`;
  }
}
