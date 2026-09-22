import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Controllable fake transporter — lets each test dictate exactly what
// nodemailer's sendMail() resolves/rejects with, without touching real SMTP.
const sendMailMock = vi.fn();
const verifyMock = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock, verify: verifyMock })),
    getTestMessageUrl: vi.fn(() => false),
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function freshEmailService(envOverrides = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'store@gmail.com',
    SMTP_PASSWORD: 'app-password',
    EMAIL_FROM_ADDRESS: 'store@gmail.com',
    EMAIL_FROM_NAME: 'AURA PRO',
    ...envOverrides,
  };
  vi.resetModules();
  return import('../services/emailService.js');
}

beforeEach(() => {
  sendMailMock.mockReset();
  verifyMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('email delivery — the exact "SMTP accepted but recipient never got it" bug class', () => {
  it('reports success when the provider genuinely accepted the target recipient', async () => {
    sendMailMock.mockResolvedValue({
      accepted: ['customer@example.com'],
      rejected: [],
      response: '250 2.0.0 OK',
    });
    const { sendOtpEmail } = await freshEmailService();

    const result = await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(result).toEqual({ success: true });
  });

  it('reports FAILURE — not success — when the SMTP transaction resolves but the recipient is not in `accepted` (this is the exact Gmail DKIM/SPF-misalignment scenario: 250 OK, but the real recipient silently drops it)', async () => {
    sendMailMock.mockResolvedValue({
      accepted: [], // the provider's own response says our recipient was NOT confirmed accepted
      rejected: [],
      response: '250 2.0.0 OK',
    });
    const { sendOtpEmail } = await freshEmailService();

    const result = await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('rejected_by_provider');
  });

  it('reports failure with the real error message when sendMail throws (auth failure, network error, etc.) — never silently swallowed', async () => {
    sendMailMock.mockRejectedValue(new Error('Invalid login: 535 Authentication failed'));
    const { sendOtpEmail } = await freshEmailService();

    const result = await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/authentication failed/i);
  });

  it('never reports success when nothing is configured, regardless of what a stale transporter might have cached', async () => {
    const { sendOtpEmail } = await freshEmailService({ SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '' });

    const result = await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(result).toEqual({ success: false, reason: 'not_configured' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe('From-address / authenticated-account alignment warning (Gmail/Outlook)', () => {
  it('warns when EMAIL_FROM_ADDRESS does not match SMTP_USER on a strict-alignment host like Gmail', async () => {
    // logger must be imported AFTER freshEmailService()'s vi.resetModules(),
    // otherwise the spy attaches to a stale module instance that
    // emailService.js's fresh copy never actually calls into.
    const { sendOtpEmail } = await freshEmailService({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'store@gmail.com',
      EMAIL_FROM_ADDRESS: 'orders@aurapro.com', // deliberately mismatched
    });
    const logger = (await import('../utils/logger.js')).default;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    sendMailMock.mockResolvedValue({ accepted: ['customer@example.com'], rejected: [], response: '250 OK' });

    await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(warnSpy).toHaveBeenCalledWith('email_from_address_mismatch', expect.objectContaining({ host: 'smtp.gmail.com' }));
    warnSpy.mockRestore();
  });

  it('does not warn when EMAIL_FROM_ADDRESS matches SMTP_USER', async () => {
    const { sendOtpEmail } = await freshEmailService({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'store@gmail.com',
      EMAIL_FROM_ADDRESS: 'store@gmail.com',
    });
    const logger = (await import('../utils/logger.js')).default;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    sendMailMock.mockResolvedValue({ accepted: ['customer@example.com'], rejected: [], response: '250 OK' });

    await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(warnSpy).not.toHaveBeenCalledWith('email_from_address_mismatch', expect.anything());
    warnSpy.mockRestore();
  });

  it('does not warn for providers that do not enforce strict From/auth alignment (e.g. a transactional provider)', async () => {
    const { sendOtpEmail } = await freshEmailService({
      SMTP_HOST: 'smtp-relay.brevo.com',
      SMTP_USER: 'apikey-user',
      EMAIL_FROM_ADDRESS: 'orders@aurapro.com', // fine for a domain-verified provider
    });
    const logger = (await import('../utils/logger.js')).default;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    sendMailMock.mockResolvedValue({ accepted: ['customer@example.com'], rejected: [], response: '250 OK' });

    await sendOtpEmail('customer@example.com', '123456', 'SIGNUP_VERIFICATION');

    expect(warnSpy).not.toHaveBeenCalledWith('email_from_address_mismatch', expect.anything());
    warnSpy.mockRestore();
  });
});
