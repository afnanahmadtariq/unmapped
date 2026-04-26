// UNMAPPED - emails the user a link to their saved profile via SMTP
// (Hostinger or any SMTP provider). The profile is already encoded in the
// URL hash; this route is just a delivery mechanism. No DB; nothing about
// the user is stored server-side beyond the SMTP provider's standard log.

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface Body {
  email?: string;
  url?: string;
  countryName?: string;
  skillCount?: number;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Module-scope transporter so connection pooling works across requests.
let _transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  _transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE !== "false", // 465 = true, 587 = false
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return _transporter;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, url, countryName, skillCount } = body;

  if (!email || !EMAIL_RX.test(email))
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  if (!url || !/^https?:\/\//.test(url))
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  if (url.length > 8000)
    return NextResponse.json({ error: "url too large" }, { status: 413 });

  const transporter = getTransporter();
  const from =
    process.env.SMTP_FROM ??
    (process.env.SMTP_USER
      ? `UNMAPPED <${process.env.SMTP_USER}>`
      : null);

  if (!transporter || !from) {
    // No SMTP configured: tell the client so it can open the user's
    // mail client via mailto: pre-filled instead.
    return NextResponse.json(
      {
        sent: false,
        provider: "none",
        reason:
          "SMTP_HOST/PORT/USER/PASS not configured on this deployment. Use the mailto fallback.",
      },
      { status: 200 }
    );
  }

  const subject = `Your UNMAPPED skills profile${countryName ? " - " + countryName : ""}`;

  const text = [
    "Here is the link to your portable UNMAPPED skills profile.",
    "Open it on any device. Edit any time and re-share a fresh link.",
    "",
    url,
    "",
    skillCount
      ? `${skillCount} ESCO-grounded skills, mapped from your own description.`
      : "",
    "",
    "UNMAPPED is open infrastructure. Your profile lives in the URL itself.",
    "Nothing about you is stored on our servers.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;background:#fafafa;color:#0a0a0a;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;">
    <div style="background:#0369a1;color:#fff;padding:20px 24px;">
      <div style="font-weight:700;letter-spacing:0.04em;font-size:18px;">UNMAPPED</div>
      <div style="opacity:0.9;font-size:12px;margin-top:4px;">Open Skills Infrastructure</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px 0;font-size:15px;">Your portable skills profile is ready.</p>
      ${
        skillCount
          ? `<p style="margin:0 0 16px 0;font-size:13px;color:#525252;">${skillCount} ESCO-grounded skills${
              countryName ? `, mapped for ${escapeHtml(countryName)}` : ""
            }.</p>`
          : ""
      }
      <p style="margin:0 0 20px 0;">
        <a href="${escapeAttr(url)}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Open my profile</a>
      </p>
      <p style="margin:0 0 8px 0;font-size:11px;color:#737373;">If the button does not open, paste this link in your browser:</p>
      <p style="margin:0;word-break:break-all;font-size:11px;color:#404040;">${escapeHtml(url)}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
      <p style="margin:0;font-size:11px;color:#737373;">
        Your profile lives entirely inside this URL. Nothing about you is stored on UNMAPPED servers. Edit any time and re-share a fresh link.
      </p>
    </div>
  </div>
</body></html>`;

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    return NextResponse.json({
      sent: true,
      provider: "smtp",
      id: info.messageId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        sent: false,
        provider: "smtp",
        error: err instanceof Error ? err.message : "Unknown SMTP error",
      },
      { status: 502 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
