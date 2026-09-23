import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Controllable fake Resend client — lets each test dictate exactly what
// emails.send()/domains.list() resolve with, without touching the real API.
// Resend's SDK resolves with {data, error} rather than throwing on an
// API-level rejection — the mock mirrors that shape.
const sendMock = vi.fn();
const domainsListMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn(function Resend() {
    return { emails: { send: sendMock }, domains: { list: domainsListMock } };
  }),
}));

const ORIGINAL_ENV = { ...process.env };

const TEST_ORDER = {
  orderNumber: 'AURA-TEST-0001',
  totalPriceInPaise: 129900,
  shippingAddress: {
    fullName: 'Test Customer',
    address: '123 Example Street',
    city: 'Testville',
    postalCode: '12345',
    country: 'Testland',
  },
};

async function freshEmailService(envOverrides = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    RESEND_API_KEY: 're_test_dummy_key',
    EMAIL_FROM_ADDRESS: 'orders@aurapro.com',
    EMAIL_FROM_NAME: 'AURA PRO',
    ...envOverrides,
  };
  vi.resetModules();
  return import('../services/emailService.js');
}

beforeEach(() => {
  sendMock.mockReset();
  domainsListMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('email delivery (Resend) — never silently reports success on a provider-level rejection', () => {
  it('reports success when Resend accepts the message', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const { sendOrderConfirmationEmail } = await freshEmailService();

    const result = await sendOrderConfirmationEmail(TEST_ORDER, 'customer@example.com');

    expect(result).toEqual({ success: true });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'AURA PRO <orders@aurapro.com>',
        to: 'customer@example.com',
      })
    );
  });

  it('reports FAILURE — not success — when Resend resolves with an error instead of throwing (e.g. unverified sending domain)', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'The orders@aurapro.com domain is not verified.', statusCode: 403, name: 'invalid_from_address' },
    });
    const { sendOrderConfirmationEmail } = await freshEmailService();

    const result = await sendOrderConfirmationEmail(TEST_ORDER, 'customer@example.com');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/not verified/i);
  });

  it('reports failure with the real error message when the send call throws (network failure, etc.) — never silently swallowed', async () => {
    sendMock.mockRejectedValue(new Error('fetch failed'));
    const { sendOrderConfirmationEmail } = await freshEmailService();

    const result = await sendOrderConfirmationEmail(TEST_ORDER, 'customer@example.com');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/fetch failed/i);
  });

  it('distinguishes a rate/quota-limit rejection from other failures via the error name, without ever reporting success', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests', statusCode: 429, name: 'rate_limit_exceeded' },
    });
    const { sendOrderConfirmationEmail } = await freshEmailService();

    const result = await sendOrderConfirmationEmail(TEST_ORDER, 'customer@example.com');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/too many requests/i);
  });

  it('never reports success when nothing is configured, regardless of what a stale client might have cached', async () => {
    const { sendOrderConfirmationEmail } = await freshEmailService({ RESEND_API_KEY: '' });

    const result = await sendOrderConfirmationEmail(TEST_ORDER, 'customer@example.com');

    expect(result).toEqual({ success: false, reason: 'not_configured' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('never includes the customer email in anything passed to the logger beyond the intended `to` field', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const { sendOrderConfirmationEmail } = await freshEmailService();
    const logger = (await import('../utils/logger.js')).default;
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    await sendOrderConfirmationEmail(TEST_ORDER, 'customer@example.com');

    expect(infoSpy).toHaveBeenCalledWith('email_sent', expect.objectContaining({ to: 'customer@example.com' }));
    infoSpy.mockRestore();
  });
});

describe('verifyEmailConnection', () => {
  it('reports ok when domains.list() succeeds', async () => {
    domainsListMock.mockResolvedValue({ data: { data: [] }, error: null });
    const { verifyEmailConnection } = await freshEmailService();

    expect(await verifyEmailConnection()).toEqual({ ok: true });
  });

  it('still reports ok for a restricted (send-only) API key — that error proves the key itself is valid', async () => {
    domainsListMock.mockResolvedValue({
      data: null,
      error: { message: 'This API key is restricted to sending only.', statusCode: 401, name: 'restricted_api_key' },
    });
    const { verifyEmailConnection } = await freshEmailService();

    expect(await verifyEmailConnection()).toEqual({ ok: true });
  });

  it('reports not ok for a genuinely invalid API key', async () => {
    domainsListMock.mockResolvedValue({
      data: null,
      error: { message: 'API key is invalid.', statusCode: 401, name: 'invalid_api_key' },
    });
    const { verifyEmailConnection } = await freshEmailService();

    const result = await verifyEmailConnection();
    expect(result.ok).toBe(false);
  });

  it('reports not_configured when RESEND_API_KEY is unset', async () => {
    const { verifyEmailConnection } = await freshEmailService({ RESEND_API_KEY: '' });

    expect(await verifyEmailConnection()).toEqual({ ok: false, reason: 'not_configured' });
    expect(domainsListMock).not.toHaveBeenCalled();
  });
});
