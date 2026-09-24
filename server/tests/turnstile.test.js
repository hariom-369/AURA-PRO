import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function registerPayload(overrides = {}) {
  return {
    name: 'Turnstile Test',
    email: 'turnstile-test@example.com',
    password: 'CorrectHorse1',
    confirmPassword: 'CorrectHorse1',
    acceptedTerms: true,
    ...overrides,
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

describe('Turnstile bot protection — not configured (default test/dev state)', () => {
  it('lets the request through with no token at all when TURNSTILE_SECRET_KEY is unset', async () => {
    process.env.TURNSTILE_SECRET_KEY = '';
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload());
    expect(res.status).toBe(201);
  });
});

describe('Turnstile bot protection — configured', () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
  });

  it('rejects the request when no turnstileToken is supplied, before any account is created', async () => {
    global.fetch = vi.fn(); // must never even be called
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload());

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects the request when Cloudflare reports the token invalid', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });

    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ turnstileToken: 'bad-token' }));

    expect(res.status).toBe(400);
  });

  it('rejects the request when the token is expired', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: false, 'error-codes': ['timeout-or-duplicate'] }) });

    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ turnstileToken: 'expired-or-reused' }));

    expect(res.status).toBe(400);
  });

  it('allows the request through when Cloudflare confirms the token is valid', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });

    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ turnstileToken: 'good-token' }));

    expect(res.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('gracefully rejects (not crashes) when the verification request itself fails (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network unreachable'));

    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ turnstileToken: 'whatever' }));

    expect(res.status).toBe(400);
  });

  it('never leaks the secret key into the response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: false }) });
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload({ turnstileToken: 'bad' }));

    expect(JSON.stringify(res.body)).not.toContain('test-secret-key');
  });
});
