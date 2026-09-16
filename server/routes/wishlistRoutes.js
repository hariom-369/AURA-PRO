import express from 'express';
import { getWishlist, toggleWishlistItem } from '../controllers/wishlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/', getWishlist);
router.post('/toggle', toggleWishlistItem);

export default router;