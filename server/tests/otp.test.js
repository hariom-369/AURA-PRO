import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isEmailConfigured: vi.fn(() => false) };
});

const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;
const PendingRegistration = (await import('../models/PendingRegistration.js')).default;
const { isEmailConfigured } = await import('../services/emailService.js');

const CREDENTIALS = { name: 'OTP Tester', email: 'otptester@example.com', password: 'password123', phone: '9123456789' };

afterEach(() => {
  vi.mocked(isEmailConfigured).mockReturnValue(false);
});

describe('Signup OTP verification', () => {
  it('register does NOT create a User document — only a pending registration, until OTP is verified', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);

    expect(res.status).toBe(200);
    expect(res.body.data.pendingToken).toBeTruthy();
    expect(res.body.data.devCode).toMatch(/^\d{6}$/);
    expect(res.body.data.token).toBeUndefined();

    // The core guarantee: no account exists in the database yet.
    const user = await User.findOne({ email: CREDENTIALS.email });
    expect(user).toBeNull();

    const pending = await PendingRegistration.findOne({ email: CREDENTIALS.email });
    expect(pending).toBeTruthy();
    expect(pending.passwordHash).not.toBe(CREDENTIALS.password); // never stored in plaintext
  });

  it('rejects a wrong code and reports remaining attempts, without ever creating the account', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken } = registerRes.body.data;

    const res = await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrect code/i);

    const user = await User.findOne({ email: CREDENTIALS.email });
    expect(user).toBeNull();
  });

  it('accepts the correct code, creates the account only now, and issues a real access token', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken, devCode } = registerRes.body.data;

    const res = await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: devCode });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe(CREDENTIALS.email);

    const user = await User.findOne({ email: CREDENTIALS.email });
    expect(user.isEmailVerified).toBe(true);
    expect(await user.comparePassword(CREDENTIALS.password)).toBe(true);

    // The pending record is cleaned up once the real account exists.
    const pending = await PendingRegistration.findOne({ email: CREDENTIALS.email });
    expect(pending).toBeNull();
  });

  it('locks out further attempts after 5 wrong codes, even if the 6th guess would have been correct', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken, devCode } = registerRes.body.data;

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: '111111' });
    }

    const res = await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: devCode });

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many/i);
  });

  it('NEVER exposes a devCode in production, even when email delivery fails — surfaces a 503 error instead', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);

      expect(res.status).toBe(503);
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/devCode/);

      // No account should ever be created without a delivered/verified code.
      const user = await User.findOne({ email: CREDENTIALS.email });
      expect(user).toBeNull();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('OTP_DEV_FALLBACK=false disables the dev fallback even outside production', async () => {
    process.env.OTP_DEV_FALLBACK = 'false';
    try {
      const res = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
      expect(res.status).toBe(503);
      expect(JSON.stringify(res.body)).not.toMatch(/devCode/);
    } finally {
      delete process.env.OTP_DEV_FALLBACK;
    }
  });

  it('rejects a pendingToken used against the wrong purpose endpoint', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken, devCode } = registerRes.body.data;

    // This token was issued for SIGNUP_VERIFICATION — using it against the
    // login-OTP endpoint must fail even with the right code.
    const res = await request(app).post('/api/v1/auth/verify-login-otp').send({ pendingToken, code: devCode });

    expect(res.status).toBe(401);
  });
});

describe('Login OTP (2FA)', () => {
  async function registerAndVerify() {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken, devCode } = registerRes.body.data;
    await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: devCode });
  }

  it('login with correct password does not return a token directly — it requires a login OTP', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: CREDENTIALS.password });

    expect(res.status).toBe(200);
    expect(res.body.data.purpose).toBe('LOGIN');
    expect(res.body.data.pendingToken).toBeTruthy();
    expect(res.body.data.token).toBeUndefined();
  });

  it('completes login after submitting the correct OTP', async () => {
    await registerAndVerify();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: CREDENTIALS.password });
    const { pendingToken, devCode } = loginRes.body.data;

    const res = await request(app).post('/api/v1/auth/verify-login-otp').send({ pendingToken, code: devCode });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('login fails for an email that only has a pending (never-verified) registration — no account exists to log into', async () => {
    await request(app).post('/api/v1/auth/register').send(CREDENTIALS); // never verified

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: CREDENTIALS.password });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects login for the wrong password before ever touching OTP', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: CREDENTIALS.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
  });
});

describe('Resend OTP', () => {
  it('issues a new pendingToken and code on request', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken: firstToken, devCode: firstCode } = registerRes.body.data;

    const resendRes = await request(app)
      .post('/api/v1/auth/resend-otp')
      .send({ pendingToken: firstToken, purpose: 'SIGNUP_VERIFICATION' });

    expect(resendRes.status).toBe(200);
    const { pendingToken: newToken, devCode: newCode } = resendRes.body.data;
    expect(newToken).toBeTruthy();

    // The old code must no longer work — only the newest OTP is valid.
    const oldCodeAttempt = await request(app)
      .post('/api/v1/auth/verify-signup-otp')
      .send({ pendingToken: newToken, code: firstCode });
    if (firstCode !== newCode) {
      expect(oldCodeAttempt.status).toBe(400);
    }

    const res = await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken: newToken, code: newCode });
    expect(res.status).toBe(201);
  });

  it('allows an immediate resend when SMTP is not configured (nothing is actually being sent/spammed)', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken } = registerRes.body.data;

    const res = await request(app)
      .post('/api/v1/auth/resend-otp')
      .send({ pendingToken, purpose: 'SIGNUP_VERIFICATION' });

    expect(res.status).toBe(200);
    expect(res.body.data.pendingToken).toBeTruthy();
  });

  it('enforces a cooldown between resends once email is actually configured to send', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);

    const registerRes = await request(app).post('/api/v1/auth/register').send(CREDENTIALS);
    const { pendingToken } = registerRes.body.data;

    const res = await request(app)
      .post('/api/v1/auth/resend-otp')
      .send({ pendingToken, purpose: 'SIGNUP_VERIFICATION' });

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/wait/i);
  });
});
