/**
 * Lensly Email API Server
 * Lightweight Fastify server that exposes SMTP email sending via HTTP.
 * Run: node mailer/server.js
 * Default port: 3002
 */

import Fastify from "fastify";
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
  sendModerationEmail,
  sendCustomEmail,
  sendTicketReplyEmail,
} from "./mailer.js";

const fastify = Fastify({ logger: { level: "info" } });
const PORT = parseInt(process.env.MAILER_PORT || "3002", 10);
const API_SECRET = process.env.MAILER_SECRET || "";

// ── Auth middleware ────────────────────────────────────────────────────────
fastify.addHook("preHandler", async (req, reply) => {
  if (!API_SECRET) return; // no secret = open (dev mode)
  const auth = req.headers["x-mailer-secret"];
  if (auth !== API_SECRET) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// ── Health check ────────────────────────────────────────────────────────────
fastify.get("/health", async () => ({ status: "ok", service: "lensly-mailer" }));

// ── Routes ──────────────────────────────────────────────────────────────────

fastify.post("/send/welcome", async (req, reply) => {
  const { to, username, displayName } = req.body;
  if (!to || !username) return reply.code(400).send({ error: "to and username required" });
  const result = await sendWelcomeEmail({ to, username, displayName });
  return { ok: true, ...result };
});

fastify.post("/send/verify", async (req, reply) => {
  const { to, username, token } = req.body;
  if (!to || !username || !token) return reply.code(400).send({ error: "to, username, token required" });
  const result = await sendVerificationEmail({ to, username, token });
  return { ok: true, ...result };
});

fastify.post("/send/reset-password", async (req, reply) => {
  const { to, username, token } = req.body;
  if (!to || !username || !token) return reply.code(400).send({ error: "to, username, token required" });
  const result = await sendPasswordResetEmail({ to, username, token });
  return { ok: true, ...result };
});

fastify.post("/send/security-alert", async (req, reply) => {
  const { to, username, action, ip, userAgent } = req.body;
  if (!to || !username || !action) return reply.code(400).send({ error: "to, username, action required" });
  const result = await sendSecurityAlertEmail({ to, username, action, ip, userAgent });
  return { ok: true, ...result };
});

fastify.post("/send/moderation", async (req, reply) => {
  const { to, username, action, reason, expiresAt } = req.body;
  if (!to || !username || !action) return reply.code(400).send({ error: "to, username, action required" });
  const result = await sendModerationEmail({ to, username, action, reason, expiresAt });
  return { ok: true, ...result };
});

fastify.post("/send/custom", async (req, reply) => {
  const { to, subject, bodyHtml, bodyText } = req.body;
  if (!to || !subject || !bodyHtml) return reply.code(400).send({ error: "to, subject, bodyHtml required" });
  const result = await sendCustomEmail({ to, subject, bodyHtml, bodyText });
  return { ok: true, ...result };
});

fastify.post("/send/ticket-reply", async (req, reply) => {
  const { to, username, displayName, ticketId, senderName, replySnippet } = req.body;
  if (!to || !ticketId || !senderName || !replySnippet) {
    return reply.code(400).send({ error: "to, ticketId, senderName, replySnippet required" });
  }
  const result = await sendTicketReplyEmail({ to, username, displayName, ticketId, senderName, replySnippet });
  return { ok: true, ...result };
});

// ── Start ────────────────────────────────────────────────────────────────────
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\n✅ Lensly Mailer API running on http://localhost:${PORT}`);
  console.log(`   Health: GET  http://localhost:${PORT}/health`);
  console.log(`   Routes:`);
  console.log(`     POST /send/welcome`);
  console.log(`     POST /send/verify`);
  console.log(`     POST /send/reset-password`);
  console.log(`     POST /send/security-alert`);
  console.log(`     POST /send/moderation`);
  console.log(`     POST /send/custom`);
  console.log(`     POST /send/ticket-reply\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
