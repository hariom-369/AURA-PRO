import express from 'express';
import { getUserAddresses, createAddress } from '../controllers/addressController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/', getUserAddresses);
router.post('/', createAddress);

export default router;