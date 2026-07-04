/**
 * Lensly Mailer — Nodemailer SMTP module
 * Reads SMTP_URL and EMAIL_FROM from .env (or process.env)
 * Falls back to logging links to console in dev mode (no SMTP_URL set).
 */

import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env from project root if not already loaded ─────────────────────
try {
  const envPath = resolve(__dirname, "../.env");
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env not found — rely on actual environment variables
}

// ── Transport ──────────────────────────────────────────────────────────────
const SMTP_URL = process.env.SMTP_URL || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "Lensly <noreply@lensly.app>";
const APP_URL = process.env.APP_URL || "http://localhost:5173";

let transporter;

if (SMTP_URL) {
  transporter = nodemailer.createTransport(SMTP_URL, {
    from: EMAIL_FROM,
  });
  console.log("[Mailer] ✅ SMTP transport configured via SMTP_URL");
} else {
  // Ethereal dev account — auto-creates a test mailbox
  transporter = null;
  console.log("[Mailer] ⚠️  No SMTP_URL set — email links will be logged to console");
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function getTransport() {
  if (transporter) return transporter;
  // Create a one-time Ethereal test account for local development
  const testAccount = await nodemailer.createTestAccount();
  const t = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log(`[Mailer] 📬 Ethereal dev account: ${testAccount.user}`);
  return t;
}

function brandedHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #07080F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #F0F2FF; }
    .wrapper { max-width: 560px; margin: 40px auto; }
    .card { background: #0D0F1A; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #e94560, #ff6b6b); padding: 32px; text-align: center; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: #fff; }
    .logo span { opacity: 0.85; }
    .body { padding: 36px 32px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px; }
    p { font-size: 15px; color: #7A82A0; line-height: 1.65; margin: 0 0 20px; }
    .btn {
      display: inline-block; padding: 14px 28px;
      background: linear-gradient(135deg, #4F7CFF, #8C5EFF);
      color: #fff !important; font-weight: 700; font-size: 15px;
      border-radius: 10px; text-decoration: none;
      box-shadow: 0 8px 24px rgba(233, 69, 96, 0.4);
    }
    .btn-danger { background: linear-gradient(135deg, #ff4757, #ff6b6b); box-shadow: 0 8px 24px rgba(255, 71, 87, 0.4); }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 28px 0; }
    .fallback { font-size: 12px; color: #4A5270; word-break: break-all; }
    .footer { padding: 20px 32px; text-align: center; font-size: 12px; color: #4A5270; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">Lensly</div>
      </div>
      <div class="body">
        ${bodyHtml}
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Lensly · You received this because an action was taken on your account.
      <br/>If you did not request this, please ignore this email or <a href="${APP_URL}/support" style="color:#4F7CFF;">contact support</a>.
    </div>
  </div>
</body>
</html>`;
}

// ── Send helper ────────────────────────────────────────────────────────────
async function send({ to, subject, html, text }) {
  const t = await getTransport();
  const info = await t.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text: text || subject,
  });
  // In dev, log the preview URL
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.log(`[Mailer] 📧 Preview → ${preview}`);
  }
  return { messageId: info.messageId, preview: preview || null };
}

// ── Email Templates ────────────────────────────────────────────────────────

/**
 * Welcome email sent after registration.
 */
export async function sendWelcomeEmail({ to, username, displayName }) {
  const name = displayName || username;
  const html = brandedHtml("Welcome to Lensly!", `
    <h1>Welcome, ${name}! 👋</h1>
    <p>You've successfully created your Lensly account. We're thrilled to have you here.</p>
    <p>Start by joining a server, chatting with friends, or creating your own community.</p>
    <p style="text-align:center; margin-top: 28px;">
      <a href="${APP_URL}" class="btn">Open Lensly →</a>
    </p>
    <hr class="divider" />
    <p style="font-size:13px; margin:0;">Your username: <strong style="color:#F0F2FF;">@${username}</strong></p>
  `);

  return send({
    to,
    subject: "Welcome to Lensly!",
    html,
    text: `Welcome to Lensly, ${name}! Open the app at ${APP_URL}`,
  });
}

/**
 * Email verification link.
 */
export async function sendVerificationEmail({ to, username, token }) {
  const url = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const html = brandedHtml("Verify your Lensly email", `
    <h1>Verify your email ✉️</h1>
    <p>Hi <strong style="color:#F0F2FF;">@${username}</strong>, please confirm your email address to complete your account setup.</p>
    <p style="text-align:center; margin-top: 28px;">
      <a href="${url}" class="btn">Verify Email →</a>
    </p>
    <hr class="divider" />
    <p class="fallback">If the button doesn't work, copy and paste this link:<br/>${url}</p>
    <p class="fallback" style="margin-top:12px;">This link expires in <strong>24 hours</strong>.</p>
  `);

  console.log(`[Mailer] Verification URL for ${username}: ${url}`);
  return send({
    to,
    subject: "Verify your Lensly email address",
    html,
    text: `Verify your Lensly email: ${url}`,
  });
}

/**
 * Password reset email.
 */
export async function sendPasswordResetEmail({ to, username, token }) {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const html = brandedHtml("Reset your Lensly password", `
    <h1>Reset your password 🔐</h1>
    <p>Hi <strong style="color:#F0F2FF;">@${username}</strong>, we received a request to reset the password for your Lensly account.</p>
    <p style="text-align:center; margin-top: 28px;">
      <a href="${url}" class="btn btn-danger">Reset Password →</a>
    </p>
    <hr class="divider" />
    <p class="fallback">If the button doesn't work, copy and paste:<br/>${url}</p>
    <p class="fallback" style="margin-top:12px;">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email — your password won't change.</p>
  `);

  console.log(`[Mailer] Password reset URL for ${username}: ${url}`);
  return send({
    to,
    subject: "Reset your Lensly password",
    html,
    text: `Reset your Lensly password: ${url}`,
  });
}

/**
 * Security alert email (new login from unknown device, etc.)
 */
export async function sendSecurityAlertEmail({ to, username, action, ip, userAgent }) {
  const html = brandedHtml("Security Alert — Lensly", `
    <h1>Security Alert ⚠️</h1>
    <p>Hi <strong style="color:#F0F2FF;">@${username}</strong>, we detected the following activity on your account:</p>
    <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
      <tr><td style="padding:8px 0; color:#7A82A0; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.06);">Action</td><td style="padding:8px 0; font-size:13px; font-weight:700; text-align:right;">${action}</td></tr>
      ${ip ? `<tr><td style="padding:8px 0; color:#7A82A0; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.06);">IP Address</td><td style="padding:8px 0; font-size:13px; text-align:right;">${ip}</td></tr>` : ""}
      ${userAgent ? `<tr><td style="padding:8px 0; color:#7A82A0; font-size:13px;">Device</td><td style="padding:8px 0; font-size:13px; text-align:right; word-break:break-all;">${userAgent.slice(0, 80)}</td></tr>` : ""}
    </table>
    <p>If this was you, no action is needed. If you did not perform this action, please change your password immediately.</p>
    <p style="text-align:center; margin-top: 28px;">
      <a href="${APP_URL}/settings" class="btn btn-danger">Secure My Account →</a>
    </p>
  `);

  return send({
    to,
    subject: `Security Alert: ${action} — Lensly`,
    html,
    text: `Security alert for @${username}: ${action}. Visit ${APP_URL}/settings to secure your account.`,
  });
}

/**
 * Moderation action notification (ban, warning, etc.)
 */
export async function sendModerationEmail({ to, username, action, reason, expiresAt }) {
  const actionColors = { BAN: "#EF4444", SUSPEND: "#F59E0B", WARNING: "#FBBF24", MUTE: "#8C5EFF" };
  const color = actionColors[action?.toUpperCase()] || "#4F7CFF";
  const html = brandedHtml("Moderation Notice — Lensly", `
    <h1>Moderation Notice</h1>
    <p>Hi <strong style="color:#F0F2FF;">@${username}</strong>, a moderation action has been applied to your account.</p>
    <div style="background:#111422; border-left:4px solid ${color}; border-radius:0 10px 10px 0; padding:16px 20px; margin:20px 0;">
      <div style="font-size:13px; font-weight:700; color:${color}; text-transform:uppercase; margin-bottom:6px;">${action}</div>
      <div style="font-size:14px; color:#F0F2FF;">${reason || "Violation of Lensly Community Guidelines"}</div>
      ${expiresAt ? `<div style="font-size:12px; color:#7A82A0; margin-top:8px;">Expires: ${new Date(expiresAt).toUTCString()}</div>` : ""}
    </div>
    <p>If you believe this is a mistake, you may appeal through our support system.</p>
    <p style="text-align:center;">
      <a href="${APP_URL}/support" class="btn">Submit Appeal →</a>
    </p>
  `);

  return send({
    to,
    subject: `Moderation Notice: ${action} — Lensly`,
    html,
    text: `Moderation notice for @${username}: ${action}. Reason: ${reason}. Visit ${APP_URL}/support to appeal.`,
  });
}

/**
 * Send a raw/custom email (for admin use).
 */
export async function sendCustomEmail({ to, subject, bodyHtml, bodyText }) {
  const html = brandedHtml(subject, bodyHtml);
  return send({ to, subject, html, text: bodyText || subject });
}

/**
 * Send a ticket reply notification email.
 */
export async function sendTicketReplyEmail({ to, username, displayName, ticketId, senderName, replySnippet }) {
  const name = displayName || username || "User";
  const url = `${APP_URL}/support`; // Direct link to support area where they can reply
  const html = brandedHtml("New reply on your ticket", `
    <h1>New Reply on Ticket #${ticketId} ✉️</h1>
    <p>Hi <strong>${name}</strong>,</p>
    <p><strong>${senderName}</strong> left a reply on your support ticket:</p>
    <div style="background:#111422; border-left:4px solid #4F7CFF; border-radius:0 10px 10px 0; padding:16px 20px; margin:20px 0; font-style:italic; color:#F0F2FF;">
      "${replySnippet}"
    </div>
    <p style="text-align:center; margin-top: 28px;">
      <a href="${url}" class="btn">View Support & Reply →</a>
    </p>
    <hr class="divider" />
    <p class="fallback">If the button doesn't work, copy and paste this link:<br/>${url}</p>
  `);

  return send({
    to,
    subject: `New reply on Support Ticket #${ticketId}`,
    html,
    text: `Hi ${name}, ${senderName} replied on your ticket #${ticketId}. View it here: ${url}`,
  });
}

export { send };
