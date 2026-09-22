import express from 'express';
import {
  aiHealth,
  aiSearch,
  aiChat,
  aiCompare,
  aiSimilarProducts,
  aiRecommendations,
  aiBundle,
  aiReviewSummary,
  aiGenerateDescription,
  aiApproveDescription,
  aiBusinessInsights,
} from '../controllers/aiController.js';
import { protect, adminOnly, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/health', aiHealth);
router.post('/search', aiSearch);
router.post('/chat', optionalAuth, aiChat);
router.post('/compare', aiCompare);
router.get('/products/:id/similar', aiSimilarProducts);
router.get('/products/:id/bundle', aiBundle);
router.get('/products/:id/review-summary', aiReviewSummary);
router.post('/recommendations', aiRecommendations);

router.post('/admin/products/:id/generate-description', protect, adminOnly, aiGenerateDescription);
router.post('/admin/products/:id/approve-description', protect, adminOnly, aiApproveDescription);
router.get('/admin/insights', protect, adminOnly, aiBusinessInsights);

export default router;
