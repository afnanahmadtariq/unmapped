// UNMAPPED - emails the user a link to their saved profile.
// The profile is already encoded in the URL hash; this route is just a
// delivery mechanism. No DB; nothing about the user is stored server-side
// beyond Resend's standard delivery log.

import { NextResponse } from "next/server";
import { Resend } from "resend";

interface Body {
  email?: string;
  url?: string;
  countryName?: string;
  skillCount?: number;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "UNMAPPED <onboarding@resend.dev>";

  if (!apiKey) {
    // Honest signal to the client: no Resend key is configured. The frontend
    // will fall back to opening the user's mail client via mailto:.
    return NextResponse.json(
      {
        sent: false,
        provider: "none",
        reason:
          "RESEND_API_KEY not configured on this deployment. Use the mailto fallback.",
      },
      { status: 200 }
    );
  }

  const resend = new Resend(apiKey);
  const subject = `Your UNMAPPED skills profile${countryName ? " — " + countryName : ""}`;
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
<html><head><meta charset="utf-8"><title>${subject}</title></head>
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
              countryName ? `, mapped for ${countryName}` : ""
            }.</p>`
          : ""
      }
      <p style="margin:0 0 20px 0;">
        <a href="${url}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Open my profile</a>
      </p>
      <p style="margin:0 0 8px 0;font-size:11px;color:#737373;">If the button does not open, paste this link in your browser:</p>
      <p style="margin:0;word-break:break-all;font-size:11px;color:#404040;">${url}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
      <p style="margin:0;font-size:11px;color:#737373;">
        Your profile lives entirely inside this URL. Nothing about you is stored on UNMAPPED servers. Edit any time and re-share a fresh link.
      </p>
    </div>
  </div>
</body></html>`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      text,
      html,
    });
    if (error) {
      return NextResponse.json(
        { sent: false, provider: "resend", error: error.message ?? String(error) },
        { status: 502 }
      );
    }
    return NextResponse.json({ sent: true, provider: "resend", id: data?.id });
  } catch (err) {
    return NextResponse.json(
      {
        sent: false,
        provider: "resend",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
