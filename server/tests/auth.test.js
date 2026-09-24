import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';

const VALID_PASSWORD = 'CorrectHorse1';

function registerPayload(overrides = {}) {
  return {
    name: 'Test User',
    email: 'newuser@example.com',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    acceptedTerms: true,
    ...overrides,
  };
}

describe('POST /auth/register', () => {
  it('creates a new account and returns a usable session', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe('newuser@example.com');
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.password).toBeUndefined();

    const stored = await User.findOne({ email: 'newuser@example.com' }).select('+password');
    expect(stored.password).not.toBe(VALID_PASSWORD); // hashed, never plaintext
    expect(stored.password.startsWith('$argon2id$')).toBe(true);
  });

  it('never grants admin or any other role regardless of what the request body contains', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ role: 'admin', isAdmin: true }));

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('customer');
    const stored = await User.findOne({ email: 'newuser@example.com' });
    expect(stored.role).toBe('customer');
  });

  it('rejects a duplicate email registration', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ name: 'Someone Else' }));

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('rejects an invalid email address', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(registerPayload({ password: 'weak', confirmPassword: 'weak' }));
    expect(res.status).toBe(400);
  });

  it('rejects a password/confirmPassword mismatch', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(registerPayload({ confirmPassword: 'SomethingElse1' }));
    expect(res.status).toBe(400);
  });

  it('rejects registration without accepting terms', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ acceptedTerms: false }));
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  async function seedUser() {
    return request(app).post('/api/v1/auth/register').send(registerPayload());
  }

  it('logs in with correct credentials', async () => {
    await seedUser();
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('rejects an incorrect password with a generic message', async () => {
    await seedUser();
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('rejects a nonexistent email with the exact same generic message (no enumeration)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'WhoKnows1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('rejects login for a deactivated account', async () => {
    await seedUser();
    await User.updateOne({ email: 'newuser@example.com' }, { isActive: false });

    const res = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('issues a short-lived token when rememberMe is false, and a long-lived one when true', async () => {
    await seedUser();
    const short = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD, rememberMe: false });
    const long = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD, rememberMe: true });

    const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
    const shortPayload = decode(short.body.data.token);
    const longPayload = decode(long.body.data.token);
    expect(longPayload.exp - longPayload.iat).toBeGreaterThan(shortPayload.exp - shortPayload.iat);
  });
});

describe('Authorization — buyers cannot reach seller/admin-only routes', () => {
  async function loginToken() {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD });
    return res.body.data.token;
  }

  it('rejects a plain customer on a seller-only endpoint', async () => {
    const token = await loginToken();
    const res = await request(app).get('/api/v1/seller/store').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a plain customer on an admin-only endpoint', async () => {
    const token = await loginToken();
    const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('changes the password when the current one is correct', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD });
    const token = loginRes.body.data.token;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: VALID_PASSWORD, newPassword: 'BrandNewPass1' });

    expect(res.status).toBe(200);
    const relogin = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: 'BrandNewPass1' });
    expect(relogin.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'newuser@example.com', password: VALID_PASSWORD });
    const token = loginRes.body.data.token;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword1', newPassword: 'BrandNewPass1' });

    expect(res.status).toBe(401);
  });
});
