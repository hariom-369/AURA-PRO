import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isEmailConfigured: vi.fn(() => false) };
});

const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;

const CREDENTIALS = { name: 'Reset Tester', email: 'resettester@example.com', password: 'password123', phone: '9988776655' };

async function registerAndVerify(overrides = {}) {
  const payload = { ...CREDENTIALS, ...overrides };
  const registerRes = await request(app).post('/api/v1/auth/register').send(payload);
  const { pendingToken, devCode } = registerRes.body.data;
  await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: devCode });
  return payload;
}

describe('Login by email or mobile number', () => {
  it('logs in using the email address', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: CREDENTIALS.password });

    expect(res.status).toBe(200);
    expect(res.body.data.pendingToken).toBeTruthy();
  });

  it('logs in using the mobile number', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.phone, password: CREDENTIALS.password });

    expect(res.status).toBe(200);
    expect(res.body.data.pendingToken).toBeTruthy();
  });

  it('registration requires a phone number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'No Phone', email: 'nophone@example.com', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

describe('Forgot / reset password', () => {
  it('completes a full reset for a real account and the new password works at login', async () => {
    await registerAndVerify();

    const forgotRes = await request(app).post('/api/v1/auth/forgot-password').send({ email: CREDENTIALS.email });
    expect(forgotRes.status).toBe(200);
    const { pendingToken, devCode } = forgotRes.body.data;
    expect(devCode).toMatch(/^\d{6}$/);

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ pendingToken, code: devCode, newPassword: 'brand-new-password-456' });
    expect(resetRes.status).toBe(200);

    // Old password no longer works.
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: CREDENTIALS.password });
    expect(oldLoginRes.status).toBe(401);

    // New password works.
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: 'brand-new-password-456' });
    expect(newLoginRes.status).toBe(200);
  });

  it('returns the exact same response shape for a non-existent email — no account-existence leak', async () => {
    const realRes = await (async () => {
      await registerAndVerify({ email: 'exists@example.com' });
      return request(app).post('/api/v1/auth/forgot-password').send({ email: 'exists@example.com' });
    })();
    const fakeRes = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'does-not-exist@example.com' });

    expect(realRes.status).toBe(fakeRes.status);
    expect(realRes.body.message).toBe(fakeRes.body.message);
    expect(Object.keys(realRes.body.data).sort()).toEqual(Object.keys(fakeRes.body.data).sort());
  });

  it('a code entered against a non-existent-email session always fails, never succeeds', async () => {
    const fakeRes = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    const { pendingToken } = fakeRes.body.data;

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ pendingToken, code: '123456', newPassword: 'whatever-password' });

    expect(resetRes.status).toBe(400);
  });

  it('resend-otp for a non-existent-email PASSWORD_RESET session returns success, not a 404', async () => {
    const fakeRes = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ghost2@example.com' });
    const { pendingToken } = fakeRes.body.data;

    const resendRes = await request(app)
      .post('/api/v1/auth/resend-otp')
      .send({ pendingToken, purpose: 'PASSWORD_RESET' });

    expect(resendRes.status).toBe(200);
  });

  it('does not reset the password for a deactivated account', async () => {
    await registerAndVerify({ email: 'deactivated@example.com' });
    await User.updateOne({ email: 'deactivated@example.com' }, { isActive: false });

    const forgotRes = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'deactivated@example.com' });
    // Same generic response — but the devCode (if present) must not correspond
    // to a real deliverable code for a deactivated account attempting reset.
    expect(forgotRes.status).toBe(200);

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ pendingToken: forgotRes.body.data.pendingToken, code: forgotRes.body.data.devCode || '000000', newPassword: 'new-password-789' });
    expect(resetRes.status).toBe(400);
  });
});
