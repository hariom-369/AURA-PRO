import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import { attachSellerProfile, requireApprovedSeller } from '../middleware/sellerMiddleware.js';

async function makeUser() {
  return User.create({ name: 'Test User', email: `u${Date.now()}${Math.random()}@example.com`, password: 'password123' });
}

function mockRes() {
  return {};
}

describe('attachSellerProfile', () => {
  it('attaches null when the user has no Seller profile, without blocking', async () => {
    const user = await makeUser();
    const req = { user };
    const next = vi.fn();

    await attachSellerProfile(req, mockRes(), next);

    expect(req.seller).toBeNull();
    expect(next).toHaveBeenCalledWith(); // called with no error
  });

  it('attaches the Seller profile regardless of its status', async () => {
    const user = await makeUser();
    const seller = await Seller.create({ user: user._id, status: 'submitted' });
    const req = { user };
    const next = vi.fn();

    await attachSellerProfile(req, mockRes(), next);

    expect(req.seller._id.toString()).toBe(seller._id.toString());
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireApprovedSeller', () => {
  it('rejects with 401 when there is no authenticated user', async () => {
    const req = {};
    const next = vi.fn();

    await requireApprovedSeller(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects with 403 when no Seller profile exists at all', async () => {
    const user = await makeUser();
    const req = { user };
    const next = vi.fn();

    await requireApprovedSeller(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it.each(['draft', 'submitted', 'under_review', 'action_required', 'rejected'])(
    'rejects with 403 for a %s (not-yet-approved) seller',
    async (status) => {
      const user = await makeUser();
      await Seller.create({ user: user._id, status });
      const req = { user };
      const next = vi.fn();

      await requireApprovedSeller(req, mockRes(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    }
  );

  it('rejects with 403 for a suspended seller even though they were once approved', async () => {
    const user = await makeUser();
    await Seller.create({ user: user._id, status: 'suspended' });
    const req = { user };
    const next = vi.fn();

    await requireApprovedSeller(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('calls next() with no error and attaches req.seller for an approved seller', async () => {
    const user = await makeUser();
    const seller = await Seller.create({ user: user._id, status: 'approved' });
    const req = { user };
    const next = vi.fn();

    await requireApprovedSeller(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.seller._id.toString()).toBe(seller._id.toString());
  });

  it('enforces the unique index — a user cannot have two Seller profiles', async () => {
    const user = await makeUser();
    await Seller.create({ user: user._id, status: 'draft' });
    await expect(Seller.create({ user: user._id, status: 'draft' })).rejects.toThrow();
  });
});
