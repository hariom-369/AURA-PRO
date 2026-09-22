import express from 'express';
import { getProductReviews, createReview, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema } from '../validators/reviewValidators.js';

const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.post('/', protect, validate(createReviewSchema), createReview);
router.delete('/:id', protect, deleteReview);

export default router;
