import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mocks the SDK boundary only — everything above it (config/firebaseAdmin.js,
// services/firebasePhoneAuthService.js, the controller/route) runs for real.
const verifyIdTokenMock = vi.fn();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  cert: vi.fn((serviceAccount) => serviceAccount),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: verifyIdTokenMock })),
}));

// app.js (and everything it pulls in, including Mongoose models) is imported
// once, like every other integration test file in this suite — re-importing
// it per test via vi.resetModules() would re-run `mongoose.model('User', ...)`
// against the same still-registered mongoose singleton and throw
// OverwriteModelError. config/firebaseAdmin.js's isFirebaseConfigured() reads
// process.env fresh on every call (nothing about it is cached at import
// time), so toggling FIREBASE_* per test works without any module reset.
const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;

const ORIGINAL_ENV = { ...process.env };

function setFirebaseConfigured(configured) {
  if (configured) {
    process.env.FIREBASE_PROJECT_ID = 'aura-pro-test';
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk@aura-pro-test.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nfaketestkey\\n-----END PRIVATE KEY-----\\n';
  } else {
    process.env.FIREBASE_PROJECT_ID = '';
    process.env.FIREBASE_CLIENT_EMAIL = '';
    process.env.FIREBASE_PRIVATE_KEY = '';
  }
}

let userCounter = 0;
async function makeLegacyUser(overrides = {}) {
  userCounter += 1;
  return User.create({
    name: 'Legacy User',
    email: `legacy${userCounter}@example.com`,
    phone: `9000000${String(userCounter).padStart(3, '0')}`,
    ...overrides,
  });
}

beforeEach(() => {
  verifyIdTokenMock.mockReset();
  setFirebaseConfigured(true);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Firebase phone auth — availability', () => {
  it('reports unavailable when Firebase env vars are unset', async () => {
    setFirebaseConfigured(false);

    const res = await request(app).get('/api/v1/auth/firebase/status');

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });

  it('reports available once all three Firebase env vars are set', async () => {
    const res = await request(app).get('/api/v1/auth/firebase/status');

    expect(res.body.data.available).toBe(true);
  });

  it('phone-login returns 503 when Firebase is not configured, and never calls the SDK', async () => {
    setFirebaseConfigured(false);

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'anything' });

    expect(res.status).toBe(503);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });
});

describe('Firebase phone auth — sign-in', () => {
  it('creates a new customer account on first verified login, never granting admin', async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-1', phone_number: '+19995550001' });

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-token', role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe('customer'); // 'role: admin' in the body is ignored — never read

    const user = await User.findOne({ firebaseUid: 'firebase-uid-1' });
    expect(user).toBeTruthy();
    expect(user.role).toBe('customer');
    expect(user.phone).toBe('+19995550001');
    expect(user.phoneVerified).toBe(true);
    expect(user.email).toBeUndefined();
    expect(user.password).toBeUndefined();
  });

  it('logs an existing Firebase user back in without creating a duplicate account', async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-2', phone_number: '+19995550002' });

    const first = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 't1' });
    const second = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 't2' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.user._id).toBe(second.body.data.user._id);

    const count = await User.countDocuments({ firebaseUid: 'firebase-uid-2' });
    expect(count).toBe(1);
  });

  it('claims an existing unclaimed legacy account on first verified phone login, without creating a duplicate', async () => {
    const legacyUser = await makeLegacyUser({ phone: '+19995550003', role: 'admin' });
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-3', phone_number: '+19995550003' });

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(legacyUser._id.toString());
    // Claiming preserves the account's existing role — it's the same account, not a fresh customer signup.
    expect(res.body.data.user.role).toBe('admin');

    const claimed = await User.findById(legacyUser._id);
    expect(claimed.firebaseUid).toBe('firebase-uid-3');
    expect(claimed.phoneVerified).toBe(true);

    // No second account was created for this phone number.
    expect(await User.countDocuments({ phone: '+19995550003' })).toBe(1);

    const AuditLog = (await import('../models/AuditLog.js')).default;
    const log = await AuditLog.findOne({ action: 'user.firebase_phone_claimed', targetId: legacyUser._id });
    expect(log).toBeTruthy();
  });

  it('rejects claiming a deactivated legacy account, and does not attach the Firebase identity to it', async () => {
    const legacyUser = await makeLegacyUser({ phone: '+19995550009', isActive: false });
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-9', phone_number: '+19995550009' });

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-token' });

    expect(res.status).toBe(403);
    const unchanged = await User.findById(legacyUser._id);
    expect(unchanged.firebaseUid).toBeUndefined();
  });

  it('rejects an invalid/expired token with 401, without touching the database', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Firebase ID token has expired'));

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'expired-token' });

    expect(res.status).toBe(401);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('rejects a token verified by Firebase but with no phone number on it', async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-4' }); // no phone_number

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-but-no-phone' });

    expect(res.status).toBe(400);
  });

  it('rejects sign-in for a deactivated existing Firebase account', async () => {
    await User.create({ name: 'X', firebaseUid: 'firebase-uid-5', phone: '+19995550005', phoneVerified: true, isActive: false });
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-5', phone_number: '+19995550005' });

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-token' });

    expect(res.status).toBe(403);
  });

  it('the issued token works with existing protected routes', async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-6', phone_number: '+19995550006' });

    const loginRes = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-token' });
    const { token } = loginRes.body.data;

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.phone).toBe('+19995550006');
  });
});

describe('Firebase phone auth — single-step session', () => {
  it('issues a session directly with no OTP/pending step of any kind — Firebase already did the verification', async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-uid-7', phone_number: '+19995550007' });

    const res = await request(app).post('/api/v1/auth/firebase/phone-login').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.pendingToken).toBeUndefined();
  });
});
