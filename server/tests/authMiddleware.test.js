import { describe, it, expect, vi } from 'vitest';
import User from '../models/User.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

describe('authMiddleware.protect', () => {
  it('rejects a request with no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('rejects a malformed/invalid token', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = vi.fn();

    await protect(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('attaches req.user for a valid token belonging to an existing user', async () => {
    const user = await User.create({ name: 'Test User', email: 'authtest@example.com', password: 'password123' });
    const token = user.generateAuthToken();

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user._id.toString()).toBe(user._id.toString());
    expect(next).toHaveBeenCalledWith(); // called with no error
  });
});

describe('authMiddleware.adminOnly', () => {
  it('allows an admin user through', () => {
    const req = { user: { role: 'admin' } };
    const next = vi.fn();
    adminOnly(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a non-admin user with 403', () => {
    const req = { user: { role: 'customer' } };
    const next = vi.fn();
    adminOnly(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });
});
