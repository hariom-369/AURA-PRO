import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mocks the SDK boundary only — everything above it (googleAuthService.js,
// the controller/route) runs for real.
const verifyIdTokenMock = vi.fn();

// A real `function` (not an arrow function) so `new OAuth2Client(...)` in
// the module under test works — arrow functions can't be constructors.
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(function OAuth2ClientCtor() {
    this.verifyIdToken = verifyIdTokenMock;
  }),
}));

// app.js is imported once, like every other integration test file in this
// suite — re-importing it per test via vi.resetModules() would re-run
// mongoose.model('User', ...) against the same still-registered mongoose
// singleton and throw OverwriteModelError.
const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;

const ORIGINAL_ENV = { ...process.env };

function setGoogleConfigured(configured) {
  process.env.GOOGLE_CLIENT_ID = configured ? 'test-client-id.apps.googleusercontent.com' : '';
}

function mockGooglePayload(payload) {
  verifyIdTokenMock.mockResolvedValue({ getPayload: () => payload });
}

beforeEach(() => {
  verifyIdTokenMock.mockReset();
  setGoogleConfigured(true);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('POST /auth/google', () => {
  it('returns 503 and never calls the SDK when Google sign-in is not configured', async () => {
    setGoogleConfigured(false);
    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'anything' });

    expect(res.status).toBe(503);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it('creates a new customer account on first sign-in, never granting admin regardless of the request body', async () => {
    mockGooglePayload({ sub: 'google-uid-1', email: 'newgoogle@example.com', email_verified: true, name: 'Google User', role: 'admin' });

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'valid-token', role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('customer');
    const user = await User.findOne({ googleId: 'google-uid-1' });
    expect(user.role).toBe('customer');
    expect(user.name).toBe('Google User');
  });

  it('logs an existing Google user back in without creating a duplicate account', async () => {
    mockGooglePayload({ sub: 'google-uid-2', email: 'repeat@example.com', email_verified: true, name: 'Repeat User' });

    const first = await request(app).post('/api/v1/auth/google').send({ idToken: 't1' });
    const second = await request(app).post('/api/v1/auth/google').send({ idToken: 't2' });

    expect(first.body.data.user._id).toBe(second.body.data.user._id);
    expect(await User.countDocuments({ googleId: 'google-uid-2' })).toBe(1);
  });

  it('rejects an invalid/expired Google credential with 401, without touching the database', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Token used too late'));

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'expired' });

    expect(res.status).toBe(401);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('rejects a Google account whose email is not verified', async () => {
    mockGooglePayload({ sub: 'google-uid-3', email: 'unverified@example.com', email_verified: false, name: 'Unverified' });

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'valid-token' });

    expect(res.status).toBe(403);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('never auto-merges: a verified Google email matching an existing password account is rejected, not logged in or duplicated', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Existing', email: 'existing@example.com', password: 'CorrectHorse1', confirmPassword: 'CorrectHorse1', acceptedTerms: true });
    mockGooglePayload({ sub: 'google-uid-4', email: 'existing@example.com', email_verified: true, name: 'Existing Via Google' });

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'valid-token' });

    expect(res.status).toBe(409);
    expect(await User.countDocuments({ email: 'existing@example.com' })).toBe(1);
    const unchanged = await User.findOne({ email: 'existing@example.com' });
    expect(unchanged.googleId).toBeUndefined();
  });

  it('rejects sign-in for a deactivated existing Google account', async () => {
    mockGooglePayload({ sub: 'google-uid-5', email: 'deactivated@example.com', email_verified: true, name: 'X' });
    await request(app).post('/api/v1/auth/google').send({ idToken: 't1' });
    await User.updateOne({ googleId: 'google-uid-5' }, { isActive: false });

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 't2' });
    expect(res.status).toBe(403);
  });
});

describe('POST /auth/me/link-google', () => {
  async function loginAsExistingUser() {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Linker', email: 'linker@example.com', password: 'CorrectHorse1', confirmPassword: 'CorrectHorse1', acceptedTerms: true });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'linker@example.com', password: 'CorrectHorse1' });
    return res.body.data.token;
  }

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/auth/me/link-google').send({ idToken: 'anything' });
    expect(res.status).toBe(401);
  });

  it('links a fresh Google identity to the authenticated account', async () => {
    const token = await loginAsExistingUser();
    mockGooglePayload({ sub: 'google-uid-6', email: 'linker@example.com', email_verified: true, name: 'Linker' });

    const res = await request(app).post('/api/v1/auth/me/link-google').set('Authorization', `Bearer ${token}`).send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.hasGoogleLinked).toBe(true);
  });

  it('rejects linking when this account already has a linked Google identity', async () => {
    const token = await loginAsExistingUser();
    mockGooglePayload({ sub: 'google-uid-7', email: 'linker@example.com', email_verified: true, name: 'Linker' });
    await request(app).post('/api/v1/auth/me/link-google').set('Authorization', `Bearer ${token}`).send({ idToken: 't1' });

    mockGooglePayload({ sub: 'google-uid-8', email: 'linker@example.com', email_verified: true, name: 'Linker' });
    const res = await request(app).post('/api/v1/auth/me/link-google').set('Authorization', `Bearer ${token}`).send({ idToken: 't2' });

    expect(res.status).toBe(400);
  });

  it('rejects linking a Google identity that is already linked to a different account', async () => {
    mockGooglePayload({ sub: 'google-uid-9', email: 'other@example.com', email_verified: true, name: 'Other' });
    await request(app).post('/api/v1/auth/google').send({ idToken: 't1' }); // creates the other account, linked to google-uid-9

    const token = await loginAsExistingUser();
    mockGooglePayload({ sub: 'google-uid-9', email: 'other@example.com', email_verified: true, name: 'Other' });
    const res = await request(app).post('/api/v1/auth/me/link-google').set('Authorization', `Bearer ${token}`).send({ idToken: 't2' });

    expect(res.status).toBe(409);
  });
});
