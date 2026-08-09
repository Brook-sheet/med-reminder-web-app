// lib/email.ts
import nodemailer, { Transporter } from 'nodemailer';

// SMTP is configured entirely via environment variables so nothing
// credential-shaped ever lives in source. See .env.example for the full list.
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
//   NEXT_PUBLIC_APP_URL — used to build the clickable reset link
let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = '';

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;

  // Rebuild the transporter if the relevant env vars change (mainly matters
  // for local dev with hot-reload); otherwise reuse the cached one so we're
  // not opening a fresh SMTP connection pool on every email.
  const key = `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}:${process.env.SMTP_USER}`;
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

interface SendResetCodeParams {
  to: string;
  firstName: string;
  code: string;
  expiresInMinutes: number;
}

/**
 * Sends the password-reset code by email. Returns true if an email was
 * (or, in local dev without SMTP configured, would have been) sent.
 *
 * Deliberately does NOT throw on failure — the caller always shows the same
 * generic "if that account exists, we sent a code" message regardless of
 * whether sending actually succeeded, both to avoid account enumeration and
 * because a transient SMTP hiccup shouldn't surface as a scary error to the
 * end user. Failures are logged server-side for operators to notice.
 */
export async function sendPasswordResetEmail({ to, firstName, code, expiresInMinutes }: SendResetCodeParams): Promise<boolean> {
  const resetLink = `${getAppUrl()}/reset-password?email=${encodeURIComponent(to)}&code=${encodeURIComponent(code)}`;
  const greetingName = firstName?.trim() || 'there';

  const subject = 'Reset your Med App Reminder password';
  const text = [
    `Hi ${greetingName},`,
    '',
    `We received a request to reset your Med App Reminder password. Use the verification code below, or click the link to continue:`,
    '',
    `Verification code: ${code}`,
    `Reset link: ${resetLink}`,
    '',
    `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
    '',
    "If you didn't request this, you can safely ignore this email — your password will not be changed.",
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin-bottom: 4px;">Reset your password</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${greetingName},</p>
      <p style="color: #475569; line-height: 1.6;">
        We received a request to reset your Med App Reminder password. Use the verification code below, or click the button to continue.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; background: #f1f5f9; border-radius: 16px; padding: 16px 24px; color: #0f172a;">
          ${code}
        </div>
      </div>
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${resetLink}" style="background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 28px; border-radius: 999px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
        This code expires in ${expiresInMinutes} minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password will not be changed.
      </p>
    </div>
  `;

  const transporter = getTransporter();

  if (!transporter) {
    // No SMTP configured. In non-production environments, log the code so
    // the flow is fully testable locally without setting up a real mailbox.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[email] SMTP is not configured — password reset code for ${to} is: ${code} (link: ${resetLink})`
      );
      return true;
    }
    console.error('[email] SMTP is not configured; cannot send password reset email in production.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('[email] Failed to send password reset email:', error);
    return false;
  }
}