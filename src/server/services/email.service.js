/**
 * Outbound email service.
 *
 * The only transport implemented is Resend's HTTP API. It is called with the
 * runtime's global `fetch` (Node 18+), so real delivery needs no extra
 * dependency and the Render build stays lean.
 *
 * Set RESEND_API_KEY to enable it. With no key configured `isConfigured()`
 * returns false and callers fall back to their own development transport —
 * this module never throws for a missing key, only for a provider failure.
 *
 * Security: the API key is read once from config (never logged), and message
 * bodies are built here so no caller can inject arbitrary headers.
 */
const { config } = require('../config/env');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10 * 1000;

/** Is a real provider configured? */
function isConfigured() {
  return Boolean(config.email.resendApiKey);
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

/**
 * Send a verification code.
 *
 * @returns {Promise<{delivered: boolean, transport: string, id: string|null}>}
 * Never throws: a provider outage must not fail registration, because the
 * caller still needs to keep the (already persisted) code state coherent.
 */
async function sendOtpEmail({ to, name, code }) {
  if (!isConfigured()) {
    return { delivered: false, transport: 'none', id: null };
  }

  const payload = {
    from: config.email.from,
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
      return { delivered: false, transport: 'resend', id: null };
    }

    const data = await res.json().catch(() => ({}));
    return { delivered: true, transport: 'resend', id: data && data.id ? String(data.id) : null };
  } catch (err) {
    // Abort or network failure — log the reason, never the key.
    const reason = err && err.name === 'AbortError' ? 'timed out' : (err && err.message) || 'unknown error';
    console.error(`[email] Could not reach Resend: ${reason}`);
    return { delivered: false, transport: 'resend', id: null };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { isConfigured, sendOtpEmail, RESEND_ENDPOINT };
