/**
 * Outbound email service.
 *
 * Two transports, chosen automatically:
 *
 *  1. Resend's HTTP API — called with the runtime's global `fetch`, so enabling
 *     it needs no dependency. Preferred when RESEND_API_KEY is present.
 *  2. SMTP — works with any mail provider and with a personal mailbox such as a
 *     Gmail app password. This is the only option that reaches arbitrary
 *     recipients when no sending domain can be verified, because Resend's shared
 *     sandbox sender only delivers to the Resend account owner.
 *
 * With neither configured `isConfigured()` returns false and callers fall back to
 * their own development transport. A delivery failure is always reported, never
 * thrown, so a provider outage cannot fail a registration.
 *
 * Security: credentials are read once from config and never logged. Message
 * bodies are built here, so no caller can inject arbitrary headers, and the
 * recipient's display name is escaped before it reaches the HTML part.
 */
const { config } = require('../config/env');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10 * 1000;
const DEFAULT_RESEND_FROM = 'MedNexus <onboarding@resend.dev>';

/** Is a real transport configured? */
function isConfigured() {
  return Boolean(config.email.resendApiKey) || Boolean(config.email.smtp.enabled);
}

/** Which transport a send would use: 'resend' | 'smtp' | 'none'. */
function activeTransport() {
  if (config.email.resendApiKey) return 'resend';
  if (config.email.smtp.enabled) return 'smtp';
  return 'none';
}

/**
 * The From header for a given transport.
 *
 * A From address is not transferable between transports: Resend only accepts a
 * verified domain (or its own sandbox sender), while an SMTP host such as Gmail
 * rejects a From it does not own. So when EMAIL_FROM is unset, SMTP authenticates
 * as the mailbox user instead of borrowing Resend's sandbox address.
 */
function resolveFrom(transport) {
  if (config.email.from) return config.email.from;
  if (transport === 'smtp') return `MedNexus <${config.email.smtp.user}>`;
  return DEFAULT_RESEND_FROM;
}

/** Escape a value before interpolating it into the HTML part. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain-text alternative — improves deliverability and reads in any client. */
function textBody({ name, code }) {
  return [
    `Hello ${name},`,
    '',
    `Your MedNexus verification code is: ${code}`,
    '',
    'It expires in 10 minutes. If you did not create a MedNexus account, you can ignore this message.',
    '',
    '— MedNexus',
  ].join('\n');
}

/** Branded HTML body. Inline styles only — email clients ignore stylesheets. */
function htmlBody({ name, code }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;font-weight:700;">MedNexus</p>
        <h1 style="margin:0 0 16px;font-size:22px;">Verify your email address</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:22px;color:#334155;">
          Hello ${escapeHtml(name)}, use the code below to finish creating your MedNexus account.
        </p>
        <p style="margin:0 0 20px;font-size:34px;letter-spacing:0.32em;font-weight:700;font-family:Consolas,Menlo,monospace;color:#0f172a;">${escapeHtml(code)}</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:21px;color:#475569;">
          This code expires in <strong>10 minutes</strong>. If you did not request it, you can safely ignore this email.
        </p>
        <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          MedNexus never asks for your password or this code by phone or chat.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

// ---------------------------------------------------------------- Resend (HTTP)

async function sendViaResend({ to, name, code }) {
  const payload = {
    from: resolveFrom('resend'),
    to: [to],
    subject: 'Your MedNexus verification code',
    text: textBody({ name, code }),
    html: htmlBody({ name, code }),
  };
  if (config.email.replyTo) payload.reply_to = config.email.replyTo;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Read a bounded amount so a huge error page cannot bloat the log.
      const detail = await res.text().catch(() => '');
      console.error(
        `[email] Resend rejected the message (HTTP ${res.status}): ${String(detail).slice(0, 300)}`
      );
      if (res.status === 403 || res.status === 422) {
        console.error(
          '[email] Resend only accepts a From address on a domain verified in your ' +
            'account, and its sandbox sender only delivers to the account owner. ' +
            'Verify a domain (or use SMTP_* instead) to reach other recipients.'
        );
      }
      return { delivered: false, transport: 'resend', id: null };
    }

    const data = await res.json().catch(() => ({}));
    return { delivered: true, transport: 'resend', id: data && data.id ? String(data.id) : null };
  } catch (err) {
    // Abort or network failure — log the reason, never the credential.
    const reason = err && err.name === 'AbortError' ? 'timed out' : (err && err.message) || 'unknown error';
    console.error(`[email] Could not reach Resend: ${reason}`);
    return { delivered: false, transport: 'resend', id: null };
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------- SMTP

let smtpTransport = null;

/**
 * A pooled SMTP transport, created once and reused.
 *
 * Required lazily so a deployment that only uses Resend never loads the module,
 * and so a missing dependency degrades to the other transport instead of
 * crashing the server at boot.
 */
function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  // eslint-disable-next-line global-require
  const nodemailer = require('nodemailer');
  const { host, port, secure, user, pass } = config.email.smtp;
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Keep a dead mail host from stalling signup.
    connectionTimeout: REQUEST_TIMEOUT_MS,
    greetingTimeout: REQUEST_TIMEOUT_MS,
    socketTimeout: REQUEST_TIMEOUT_MS,
  });
  return smtpTransport;
}

async function sendViaSmtp({ to, name, code }) {
  let nodemailer;
  try {
    // eslint-disable-next-line global-require
    nodemailer = require('nodemailer');
  } catch {
    console.error('[email] SMTP is configured but nodemailer is not installed; run npm install in src/server');
    return { delivered: false, transport: 'smtp', id: null };
  }
  void nodemailer;

  try {
    const info = await getSmtpTransport().sendMail({
      from: resolveFrom('smtp'),
      to,
      replyTo: config.email.replyTo || undefined,
      subject: 'Your MedNexus verification code',
      text: textBody({ name, code }),
      html: htmlBody({ name, code }),
    });
    return {
      delivered: true,
      transport: 'smtp',
      id: info && info.messageId ? String(info.messageId) : null,
    };
  } catch (err) {
    // Covers auth failures (535), refused connections and timeouts.
    console.error(`[email] SMTP delivery to ${config.email.smtp.host} failed: ${(err && err.message) || 'unknown error'}`);
    return { delivered: false, transport: 'smtp', id: null };
  }
}

/**
 * Send a verification code through whichever transport is configured.
 *
 * @returns {Promise<{delivered: boolean, transport: string, id: string|null}>}
 * Never throws: a provider outage must not fail registration, because the
 * caller still needs to keep the (already persisted) code state coherent.
 */
async function sendOtpEmail({ to, name, code }) {
  switch (activeTransport()) {
    case 'resend':
      return sendViaResend({ to, name, code });
    case 'smtp':
      return sendViaSmtp({ to, name, code });
    default:
      return { delivered: false, transport: 'none', id: null };
  }
}

/**
 * Report whether the configured transport is actually usable. Called at boot so
 * a bad credential is visible immediately rather than at the first signup.
 */
async function verifyTransport() {
  const transport = activeTransport();
  if (transport === 'none') return { ok: false, transport, reason: 'no transport configured' };
  if (transport === 'resend') return { ok: true, transport, reason: 'HTTP API key present' };
  try {
    await getSmtpTransport().verify();
    return { ok: true, transport, reason: 'SMTP credentials accepted' };
  } catch (err) {
    return { ok: false, transport, reason: (err && err.message) || 'SMTP verification failed' };
  }
}

module.exports = {
  isConfigured,
  activeTransport,
  resolveFrom,
  sendOtpEmail,
  verifyTransport,
  RESEND_ENDPOINT,
};
