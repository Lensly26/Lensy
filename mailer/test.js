/**
 * send-test-email.js — Sends a test email to verify SMTP is working.
 * Usage:
 *   node mailer/test.js                          # sends all email types to Ethereal
 *   node mailer/test.js you@gmail.com welcome    # sends welcome email to real address
 *   node mailer/test.js you@gmail.com all        # sends all types
 */

import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
  sendModerationEmail,
} from "./mailer.js";

const [,, targetEmail, type = "all"] = process.argv;
const to = targetEmail || "test@example.com";
const username = "testuser";

console.log(`\n📧 Lensly SMTP Test`);
console.log(`   Target : ${to}`);
console.log(`   Type   : ${type}`);
console.log(`   SMTP   : ${process.env.SMTP_URL ? "✅ Configured" : "⚠️  Not set (using Ethereal)"}\n`);

async function run() {
  try {
    if (type === "welcome" || type === "all") {
      console.log("→ Sending welcome email...");
      const r = await sendWelcomeEmail({ to, username, displayName: "Test User" });
      console.log(`  ✓ messageId: ${r.messageId}${r.preview ? `\n  📬 Preview: ${r.preview}` : ""}\n`);
    }

    if (type === "verify" || type === "all") {
      console.log("→ Sending verification email...");
      const r = await sendVerificationEmail({ to, username, token: "test-token-abc123" });
      console.log(`  ✓ messageId: ${r.messageId}${r.preview ? `\n  📬 Preview: ${r.preview}` : ""}\n`);
    }

    if (type === "reset" || type === "all") {
      console.log("→ Sending password reset email...");
      const r = await sendPasswordResetEmail({ to, username, token: "reset-token-xyz789" });
      console.log(`  ✓ messageId: ${r.messageId}${r.preview ? `\n  📬 Preview: ${r.preview}` : ""}\n`);
    }

    if (type === "security" || type === "all") {
      console.log("→ Sending security alert email...");
      const r = await sendSecurityAlertEmail({ to, username, action: "New login from unknown device", ip: "203.0.113.42", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
      console.log(`  ✓ messageId: ${r.messageId}${r.preview ? `\n  📬 Preview: ${r.preview}` : ""}\n`);
    }

    if (type === "mod" || type === "all") {
      console.log("→ Sending moderation email...");
      const r = await sendModerationEmail({ to, username, action: "WARNING", reason: "Spam in #general", expiresAt: null });
      console.log(`  ✓ messageId: ${r.messageId}${r.preview ? `\n  📬 Preview: ${r.preview}` : ""}\n`);
    }

    console.log("✅ All test emails sent successfully!\n");
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }
}

run();
