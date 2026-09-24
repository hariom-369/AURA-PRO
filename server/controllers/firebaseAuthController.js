import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyFirebaseIdToken, findOrCreateUserFromFirebase, isFirebaseConfigured } from '../services/firebasePhoneAuthService.js';
import { toUserPayload } from './authController.js';

function rethrow(error) {
  if (error.statusCode) throw new ApiError(error.statusCode, error.message);
  throw error;
}

// @desc    Report whether phone sign-in is configured — lets the frontend
//          hide the "Sign in with phone" option cleanly instead of offering
//          a button that will always fail.
// @route   GET /api/v1/auth/firebase/status
export const firebaseAuthStatus = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, { available: isFirebaseConfigured() }, 'Firebase phone auth status'));
});

// @desc    Exchange a Firebase-verified phone sign-in for a normal AURA PRO
//          session. Firebase is used for exactly one thing — proving phone
//          ownership; everything past this point (the JWT, protected
//          routes, role checks) is the same app session any other login
//          produces. See docs/FIREBASE_AUTH.md for the full account model
//          and the "never auto-merge" rule this enforces.
// @route   POST /api/v1/auth/firebase/phone-login
export const firebasePhoneLogin = asyncHandler(async (req, res) => {
  const { idToken, name } = req.body;

  let user;
  try {
    const { uid, phoneNumber } = await verifyFirebaseIdToken(idToken);
    // `name` is only ever applied to a brand-new account — see
    // findOrCreateUserFromFirebase. It is never a role/permission field.
    user = await findOrCreateUserFromFirebase({ uid, phoneNumber, name });
  } catch (error) {
    rethrow(error);
  }

  const token = user.generateAuthToken();
  res.status(200).json(new ApiResponse(200, { user: toUserPayload(user), token }, 'Signed in with phone number'));
});
