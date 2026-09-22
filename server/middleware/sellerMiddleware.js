import Seller from '../models/Seller.js';
import { ApiError } from '../utils/ApiError.js';

// Loads req.seller if the authenticated user has a Seller profile (any
// status) — never blocks the request. Mount after `protect` on routes that
// behave differently for "has applied" vs. "never applied" but don't
// require approval (e.g. the onboarding endpoints themselves).
export const attachSellerProfile = async (req, res, next) => {
  try {
    if (req.user) {
      req.seller = await Seller.findOne({ user: req.user._id });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Requires an approved, non-suspended Seller profile. Mount after `protect`
// (and after attachSellerProfile is unnecessary — this loads its own copy so
// it works standalone). Same shape as authMiddleware.adminOnly.
export const requireApprovedSeller = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required.');
    }
    const seller = await Seller.findOne({ user: req.user._id });
    if (!seller) {
      throw new ApiError(403, 'No seller account found. Apply to sell on AURA PRO first.');
    }
    if (seller.status === 'suspended') {
      throw new ApiError(403, 'Your seller account has been suspended. Contact support for details.');
    }
    if (seller.status !== 'approved') {
      throw new ApiError(403, `Your seller application is not yet approved (current status: ${seller.status}).`);
    }
    req.seller = seller;
    next();
  } catch (error) {
    next(error);
  }
};
