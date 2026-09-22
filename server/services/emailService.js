import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const BRAND_COLOR = '#6366f1';
const BRAND_DARK = '#18181b';

let transporter = null;
let transporterInitAttempted = false;

function getTransporter() {
  if (transporterInitAttempted) return transporter;
  transporterInitAttempted = true;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  return transporter;
}

export function isEmailConfigured() {
  return Boolean(getTransporter());
}

// Providers known to reject/mis-deliver mail where the From: address doesn't
// match (or isn't a verified alias of) the authenticated account. A mismatch
// here doesn't fail the SMTP transaction — the provider still returns 250 OK
// — but DKIM/SPF alignment fails on the receiving end and the message gets
// silently dropped or spam-filtered. This is the single most common cause of
// "verifyEmailConnection() says ok, but no email arrives".
const STRICT_FROM_ALIGNMENT_HOSTS = ['gmail.com', 'googlemail.com', 'outlook.com', 'office365.com'];

let fromMismatchWarned = false;
function warnIfFromAddressMismatched() {
  if (fromMismatchWarned) return;
  const host = (process.env.SMTP_HOST || '').toLowerCase();
  const isStrictHost = STRICT_FROM_ALIGNMENT_HOSTS.some((h) => host.includes(h));
  const fromAddress = (process.env.EMAIL_FROM_ADDRESS || '').toLowerCase();
  const smtpUser = (process.env.SMTP_USER || '').toLowerCase();

  if (isStrictHost && fromAddress && smtpUser && fromAddress !== smtpUser) {
    fromMismatchWarned = true;
    logger.warn('email_from_address_mismatch', {
      host: process.env.SMTP_HOST,
      fromAddress: process.env.EMAIL_FROM_ADDRESS,
      hint:
        'EMAIL_FROM_ADDRESS does not match SMTP_USER on a provider that enforces From/auth alignment (Gmail/Outlook). ' +
        'The SMTP transaction will report success, but the receiving mail server will likely fail DKIM/SPF alignment ' +
        'and silently drop or spam-filter the message. Set EMAIL_FROM_ADDRESS to the same address as SMTP_USER, or ' +
        'configure a verified "Send As" alias with that provider, or switch to a domain-verified transactional ' +
        'provider (SendGrid/Brevo/Resend/Mailgun/SES) where any From address on a verified domain works.',
    });
  }
}

// Verifies the SMTP connection/credentials without sending anything — useful
// for a startup check or a one-off `node -e` diagnostic (see docs/EMAIL.md).
export async function verifyEmailConnection() {
  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    return { ok: false, reason: 'not_configured' };
  }
  try {
    await activeTransporter.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

// Shared branded wrapper so every outbound email looks consistent. Keep
// inline styles only — this needs to render in real email clients, which
// don't load external stylesheets and strip most CSS features.
function renderEmailLayout({ title, bodyHtml }) {
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7;">
              <tr>
                <td style="background-color: ${BRAND_DARK}; padding: 24px 32px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color: ${BRAND_COLOR}; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 1px; padding: 4px 8px; border-radius: 4px;">PRO</td>
                      <td style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; padding-left: 8px;">AURA</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                    AURA PRO &mdash; this is an automated message, please don't reply directly to this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

// Every outbound email routes through here. If SMTP isn't configured, this
// logs and returns success:false instead of throwing — order/status emails
// are best-effort notifications and must never break checkout or any other
// core flow. (OTP delivery is treated differently at the call site in
// otpService.js, since a failed OTP email genuinely blocks the user.)
async function sendEmail({ to, subject, html }) {
  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    logger.info('email_skipped_not_configured', { to, subject });
    return { success: false, reason: 'not_configured' };
  }

  warnIfFromAddressMismatched();

  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'AURA PRO';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'orders@aurapro.com';
    const info = await activeTransporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
    });

    // A 250-OK response from the SMTP server is NOT proof of inbox delivery —
    // it only means the provider accepted the message for onward handling.
    // `accepted`/`rejected` (SMTP-level per-recipient outcome) is the most
    // this process can ever observe; anything past that (spam filtering,
    // DMARC drops) happens on servers we have no visibility into. Still,
    // treat an explicit rejection of our one recipient as a real failure
    // rather than reporting success.
    const wasAccepted = (info.accepted || []).some((addr) => String(addr).toLowerCase().includes(to.toLowerCase()));
    if (!wasAccepted) {
      logger.error('email_rejected_by_provider', {
        to,
        subject,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });
      return { success: false, reason: 'rejected_by_provider' };
    }

    // Only ever set for Ethereal test accounts (nodemailer.createTestAccount) —
    // a no-op for every real provider. Handy for verifying delivery in dev
    // without needing a real inbox; see docs/EMAIL.md.
    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info('email_sent', {
      to,
      subject,
      smtpResponse: info.response,
      previewUrl: previewUrl || undefined,
    });
    return { success: true };
  } catch (error) {
    logger.error('email_send_failed', { to, subject, error: error.message });
    return { success: false, reason: error.message };
  }
}

export const sendOrderConfirmationEmail = async (order, customerEmail) => {
  const body = `
    <h2 style="margin: 0 0 4px; font-size: 20px; color: #18181b;">Thank you for your order!</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #71717a;">Order Number: <strong style="color: #18181b;">${order.orderNumber}</strong></p>
    <p style="font-size: 15px; color: #18181b;">Total Paid: <strong>₹${(order.totalPriceInPaise / 100).toFixed(2)}</strong></p>
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
    <h4 style="margin: 0 0 8px; font-size: 13px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Shipping To</h4>
    <p style="margin: 0; font-size: 14px; color: #18181b; line-height: 1.6;">
      ${order.shippingAddress.fullName || 'Customer'}<br/>
      ${order.shippingAddress.address}<br/>
      ${order.shippingAddress.city}, ${order.shippingAddress.postalCode}<br/>
      ${order.shippingAddress.country}
    </p>
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
    <p style="margin: 0; font-size: 13px; color: #71717a;">Track your shipment directly from your dashboard.</p>
  `;
  return sendEmail({ to: customerEmail, subject: `Order Confirmed — ${order.orderNumber}`, html: renderEmailLayout({ bodyHtml: body }) });
};

export const sendOrderStatusEmail = async (order, customerEmail, note = '') => {
  const body = `
    <h2 style="margin: 0 0 4px; font-size: 20px; color: #18181b;">Your order status has been updated</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #71717a;">Order Number: <strong style="color: #18181b;">${order.orderNumber}</strong></p>
    <p style="font-size: 15px; color: #18181b;">New Status: <strong>${order.status}</strong></p>
    ${note ? `<p style="font-size: 14px; color: #52525b;">${note}</p>` : ''}
    ${order.trackingNumber ? `<p style="font-size: 14px; color: #18181b;">Tracking Number: <strong>${order.trackingNumber}</strong></p>` : ''}
  `;
  return sendEmail({
    to: customerEmail,
    subject: `Order Update — ${order.orderNumber} is now ${order.status}`,
    html: renderEmailLayout({ bodyHtml: body }),
  });
};

const OTP_PURPOSE_COPY = {
  SIGNUP_VERIFICATION: {
    subject: 'Verify your email — AURA PRO',
    heading: 'Confirm your email address',
    body: "Enter this code to finish creating your AURA PRO account. If you didn't create an account, you can safely ignore this email.",
  },
  LOGIN: {
    subject: 'Your sign-in code — AURA PRO',
    heading: "Confirm it's you",
    body: "Enter this code to finish signing in to AURA PRO. If this wasn't you, you can safely ignore this email — your account is still secure.",
  },
  PASSWORD_RESET: {
    subject: 'Reset your password — AURA PRO',
    heading: 'Reset your password',
    body: "Enter this code to choose a new password for your AURA PRO account. If you didn't request this, you can safely ignore this email — your password won't be changed.",
  },
};

export const sendOtpEmail = async (email, code, purpose) => {
  const copy = OTP_PURPOSE_COPY[purpose] || OTP_PURPOSE_COPY.LOGIN;
  const body = `
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #18181b;">${copy.heading}</h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #71717a; line-height: 1.6;">${copy.body}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="background-color: #f4f4f5; border-radius: 12px; padding: 20px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: ${BRAND_DARK}; font-family: 'Courier New', monospace;">${code}</span>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">This code expires in 10 minutes.</p>
  `;
  return sendEmail({ to: email, subject: copy.subject, html: renderEmailLayout({ bodyHtml: body }) });
};

export const sendLowStockAlertEmail = async (adminEmail, product) => {
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 20px; color: #dc2626;">Low Stock Alert</h2>
    <p style="font-size: 14px; color: #18181b; line-height: 1.6;">
      <strong>${product.name}</strong> (SKU: ${product.sku || 'n/a'}) is down to <strong>${product.stock}</strong> units,
      at or below its threshold of ${product.lowStockThreshold}.
    </p>
  `;
  return sendEmail({ to: adminEmail, subject: `Low Stock: ${product.name}`, html: renderEmailLayout({ bodyHtml: body }) });
};
