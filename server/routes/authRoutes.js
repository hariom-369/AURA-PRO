import express from 'express';
import { getCurrentUser, updateProfile, uploadAvatar } from '../controllers/authController.js';
import { firebaseAuthStatus, firebasePhoneLogin } from '../controllers/firebaseAuthController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/security.js';
import { updateProfileSchema, firebasePhoneLoginSchema } from '../validators/authValidators.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Firebase Phone Auth is the only sign-in method — see docs/FIREBASE_AUTH.md.
router.get('/firebase/status', firebaseAuthStatus);
router.post('/firebase/phone-login', authLimiter, validate(firebasePhoneLoginSchema), firebasePhoneLogin);

router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, validate(updateProfileSchema), updateProfile);
router.post('/me/avatar', protect, upload.single('avatar'), uploadAvatar);

export default router;
