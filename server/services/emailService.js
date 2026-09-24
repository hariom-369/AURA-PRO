import { Resend } from 'resend';
import logger from '../utils/logger.js';

const BRAND_COLOR = '#6366f1';
const BRAND_DARK = '#18181b';

let resendClient = null;
let resendInitAttempted = false;

function getResendClient() {
  if (resendInitAttempted) return resendClient;
  resendInitAttempted = true;

  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export function isEmailConfigured() {
  return Boolean(getResendClient());
}

// Resend is an HTTP API, not SMTP, so there's no connection handshake to
// "verify" the way nodemailer's transporter.verify() did. The closest
// side-effect-free proof that RESEND_API_KEY is real is a lightweight,
// read-only API call — domains.list() doubles as a hint about whether your
// sending domain is verified yet (the most common reason for a rejected
// send). A `restricted_api_key` error here still proves the key itself is
// valid (Resend recognized and authenticated it) — it just means this
// specific key doesn't have permission to list domains, which is common and
// fine for a send-only key, so that case is *not* treated as a failure.
export async function verifyEmailConnection() {
  const client = getResendClient();
  if (!client) {
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const { error } = await client.domains.list();
    if (error && error.name !== 'restricted_api_key') {
      return { ok: false, reason: error.message };
    }
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

// Every outbound email routes through here. If Resend isn't configured, this
// logs and returns success:false instead of throwing — these are all
// best-effort notifications (order confirmation/status, low-stock alerts)
// and must never break checkout or any other core flow.
async function sendEmail({ to, subject, html }) {
  const client = getResendClient();
  if (!client) {
    logger.info('email_skipped_not_configured', { to, subject });
    return { success: false, reason: 'not_configured' };
  }

  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'AURA PRO';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'orders@aurapro.com';

    // Resend's SDK does NOT throw on an API-level rejection — a rejected
    // send still resolves, just with `error` set instead of `data`. A
    // *thrown* exception here means the request itself never completed
    // (network failure, etc.), handled in the catch block below. Either way,
    // this never silently reports success — success is only ever returned
    // when Resend's own response confirms the message was accepted.
    const { data, error } = await client.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to,
      subject,
      html,
    });

    if (error) {
      // `invalid_from_address` is Resend's equivalent of the old Gmail
      // DKIM/SPF-alignment gotcha this app used to detect for SMTP: the API
      // call completes, but the message is rejected because
      // EMAIL_FROM_ADDRESS's domain isn't verified in the Resend dashboard
      // yet (Domains -> Add Domain -> add the DNS records it gives you).
      logger.error('email_rejected_by_provider', {
        to,
        subject,
        errorName: error.name,
        errorMessage: error.message,
      });
      return { success: false, reason: error.message };
    }

    logger.info('email_sent', { to, subject, emailId: data.id });
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

export const sendPasswordResetEmail = async (email, resetUrl) => {
  const body = `
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #18181b;">Reset your password</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #71717a; line-height: 1.6;">
      We received a request to reset your AURA PRO password. Click the button below to choose a new one.
      If you didn't request this, you can safely ignore this email — your password won't be changed.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${resetUrl}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; text-decoration: none;">Reset Password</a>
        </td>
      </tr>
    </table>
    <p style="margin: 20px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">This link expires in 30 minutes and can only be used once.</p>
  `;
  return sendEmail({ to: email, subject: 'Reset your password — AURA PRO', html: renderEmailLayout({ bodyHtml: body }) });
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
