import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
process.env.NODE_ENV = 'test';
// Fixed 32-byte (64 hex char) test key — deterministic, never used outside tests.
process.env.PAYOUT_ENCRYPTION_KEY =
  process.env.PAYOUT_ENCRYPTION_KEY || '0'.repeat(63) + '1';
process.env.MARKETPLACE_DEFAULT_COMMISSION_PERCENT = process.env.MARKETPLACE_DEFAULT_COMMISSION_PERCENT || '10';

// Forcibly clear every external/paid-service credential BEFORE any test file
// is imported. This used to work "by accident" because server/.env simply
// had these blank — but `app.js` calls dotenv.config() at import time, and
// dotenv never overwrites a key that's already present in process.env
// (even an empty string counts as present). So setting these to '' here,
// in this setupFile (which vitest guarantees runs before test files are
// imported), permanently wins over whatever real credentials later end up
// in server/.env — tests can never silently start hitting real Resend/Stripe/
// Gemini/Cloudinary/Google/Turnstile, no matter what gets configured for local dev.
process.env.RESEND_API_KEY = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.GEMINI_API_KEY = '';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.TURNSTILE_SECRET_KEY = '';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
