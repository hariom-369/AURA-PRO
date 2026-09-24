import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Captures the real reset URL/token that would have been emailed, without
// ever actually calling Resend — forgotPassword's response is deliberately
// enumeration-safe (always the same generic message), so the only way to
// drive a real reset-password test is to intercept what was "sent" here,
// exactly like a real end-to-end test would read the email.
const sendPasswordResetEmailMock = vi.fn(async () => ({ success: true }));
vi.mock('../services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sendPasswordResetEmail: (...args) => sendPasswordResetEmailMock(...args) };
});

const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;

function extractToken(resetUrl) {
  return resetUrl.split('/reset-password/')[1];
}

const VALID_PASSWORD = 'CorrectHorse1';

async function registerUser(email = 'reset-target@example.com') {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Reset Target', email, password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD, acceptedTerms: true });
}

beforeEach(() => {
  sendPasswordResetEmailMock.mockClear();
});

describe('POST /auth/forgot-password', () => {
  it('responds with the same generic message whether or not the email exists', async () => {
    await registerUser();
    const existing = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset-target@example.com' });
    const missing = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body.message).toBe(missing.body.message);
  });

  it('emails a reset link only when the account actually exists', async () => {
    await registerUser();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset-target@example.com' });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);

    sendPasswordResetEmailMock.mockClear();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it('never includes the raw reset token in the API response', async () => {
    await registerUser();
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset-target@example.com' });
    expect(JSON.stringify(res.body)).not.toContain('/reset-password/');
  });
});

describe('POST /auth/reset-password', () => {
  it('resets the password with a valid token, and the token cannot be reused', async () => {
    await registerUser();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset-target@example.com' });
    const [, resetUrl] = sendPasswordResetEmailMock.mock.calls[0];
    const token = extractToken(resetUrl);

    const firstUse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });
    expect(firstUse.status).toBe(200);

    const loginWithNew = await request(app).post('/api/v1/auth/login').send({ email: 'reset-target@example.com', password: 'BrandNewPass1' });
    expect(loginWithNew.status).toBe(200);

    // Reused token — must fail, not silently succeed a second time.
    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'AnotherPass2', confirmPassword: 'AnotherPass2' });
    expect(reuse.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    await registerUser();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset-target@example.com' });
    const [, resetUrl] = sendPasswordResetEmailMock.mock.calls[0];
    const token = extractToken(resetUrl);

    await User.updateOne({ email: 'reset-target@example.com' }, { passwordResetExpires: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });
    expect(res.status).toBe(400);
  });

  it('rejects a bogus/unknown token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });
    expect(res.status).toBe(400);
  });

  it('never logs the raw reset token', async () => {
    const logger = (await import('../utils/logger.js')).default;
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await registerUser();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset-target@example.com' });
    const [, resetUrl] = sendPasswordResetEmailMock.mock.calls[0];
    const token = extractToken(resetUrl);
    await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });

    const allLoggedText = JSON.stringify([...infoSpy.mock.calls, ...errorSpy.mock.calls]);
    expect(allLoggedText).not.toContain(token);
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
