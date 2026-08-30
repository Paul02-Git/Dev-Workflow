// Hand-rolled Resend integration — a single fetch call against their REST
// API, no SDK dependency (same "fetch + no library" pattern as
// src/lib/google-oauth.ts).

const RESEND_API_URL = "https://api.resend.com/emails";

function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return key;
}

// Resend's shared sandbox sender — works with zero setup, no domain
// verification needed. Swap for a verified custom domain address once
// one exists (RESEND_FROM_EMAIL).
const DEFAULT_FROM = "DEVOS <onboarding@resend.dev>";

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${detail}`);
  }
}

const EMAIL_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared card chrome (wordmark + outer table) both templates below render inside. */
function renderEmailShell(bodyHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px; max-width:100%; background:#ffffff; border:1px solid #ece9e4; border-radius:12px;">
            <tr>
              <td style="padding:40px 36px 32px;">
                <div style="font-family:${EMAIL_FONT}; font-size:17px; font-weight:700; letter-spacing:0.2px; color:#0b0b0b; margin:0 0 28px;">
                  DEV<span style="color:#e86a33;">OS</span>
                </div>
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="font-family:${EMAIL_FONT}; font-size:11px; color:#b3b1ac; margin:20px 0 0; text-align:center;">Works once, expires in 20 minutes. Didn't request this? You can ignore it.</p>
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Plain template-literal HTML, no React-email framework — matches this
 * app's existing minimal-dependency approach. Table-based layout (not
 * flexbox/divs) is deliberate: it's the one layout approach that renders
 * consistently across Outlook desktop's Word engine as well as every
 * modern mail client, which plain CSS doesn't reliably do.
 *
 * Deliberately no logo <img> — most inboxes block remote images by
 * default until the recipient clicks "show images" (and some strip them
 * entirely), so a hotlinked logo is unreliable across real clients even
 * when the URL itself resolves fine. The text wordmark below is the
 * actual brand mark; it always renders, no image round trip needed.
 *
 * Link-only — no code. The 6-digit code is a separate, client-requested
 * fallback (see renderClientMagicCodeEmail below); it's only ever minted
 * and sent when the client explicitly asks for it on the "different
 * device" step, not bundled into every link email by default.
 */
export function renderClientMagicLinkEmail(input: { clientName: string; url: string; isWelcome: boolean }): { subject: string; html: string } {
  const firstName = input.clientName.split(" ")[0];
  const subject = input.isWelcome ? "Your workspace is ready" : "Your login link";
  const heading = input.isWelcome ? `Welcome, ${firstName}` : `Hi ${firstName}`;
  const intro = input.isWelcome
    ? `Your workspace is set up and ready to go. This is where you'll see your project's progress, share files, and hear updates as work moves forward — all in one place.`
    : `Here's your login link.`;
  const cta = input.isWelcome ? "Open your workspace" : "Sign in";

  const html = renderEmailShell(`
    <p style="font-family:${EMAIL_FONT}; font-size:18px; font-weight:700; color:#0b0b0b; margin:0 0 10px;">${heading}</p>
    <p style="font-family:${EMAIL_FONT}; font-size:15px; line-height:1.6; color:#52514e; margin:0 0 28px;">${intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:8px; background:#0b0b0b;">
          <a href="${input.url}" style="display:inline-block; padding:13px 26px; font-family:${EMAIL_FONT}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">${cta}</a>
        </td>
      </tr>
    </table>
  `);
  return { subject, html };
}

/**
 * Code-only — no link, no sign-in button. Sent only when a client
 * explicitly asks for it (they're opening the email on a different
 * device than the one they're signing in on, and clicking a link there
 * wouldn't help) — deliberately not bundled into the default link email,
 * so a code only ever exists in an inbox if someone actually needed one.
 */
export function renderClientMagicCodeEmail(input: { clientName: string; code: string }): { subject: string; html: string } {
  const firstName = input.clientName.split(" ")[0];
  const html = renderEmailShell(`
    <p style="font-family:${EMAIL_FONT}; font-size:18px; font-weight:700; color:#0b0b0b; margin:0 0 10px;">Hi ${firstName}</p>
    <p style="font-family:${EMAIL_FONT}; font-size:15px; line-height:1.6; color:#52514e; margin:0 0 20px;">Here's your login code. Enter it on the sign-in page to continue.</p>
    <p style="font-family:${EMAIL_FONT}; font-size:28px; font-weight:700; letter-spacing:6px; color:#0b0b0b; margin:0;">${input.code}</p>
  `);
  return { subject: "Your login code", html };
}
