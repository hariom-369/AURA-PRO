import express from 'express';
import {
  getApplication,
  updateAccountStep,
  updateBusinessStep,
  uploadVerificationDocument,
  deleteVerificationDocument,
  getOwnVerificationDocumentUrl,
  updatePayoutStep,
  submitApplication,
  getStoreSettings,
  updateStoreSettings,
  getSellerAnalytics,
  listSellerTransactions,
  listSellerProductReviews,
} from '../controllers/sellerController.js';
import {
  sellerListProducts,
  sellerCreateProduct,
  sellerUpdateProduct,
  sellerDeleteProduct,
  sellerUploadProductImage,
} from '../controllers/sellerProductController.js';
import { sellerListOrders, sellerGetOrder, sellerUpdateItemFulfillment } from '../controllers/sellerOrderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireApprovedSeller } from '../middleware/sellerMiddleware.js';
import { validate } from '../middleware/validate.js';
import uploadDocument from '../middleware/uploadDocument.js';
import upload from '../middleware/upload.js';
import {
  updateAccountStepSchema,
  updateBusinessStepSchema,
  uploadDocumentSchema,
  updatePayoutStepSchema,
  updateStoreSettingsSchema,
  updateFulfillmentStatusSchema,
} from '../validators/sellerValidators.js';
import { createProductSchema, updateProductSchema } from '../validators/productValidators.js';

const router = express.Router();

// Onboarding is available to any logged-in customer — becoming a seller
// never requires a separate account (see sellerController's getOrCreateDraft).
router.use(protect);

router.get('/application', getApplication);
router.patch('/application/account', validate(updateAccountStepSchema), updateAccountStep);
router.patch('/application/business', validate(updateBusinessStepSchema), updateBusinessStep);
router.post(
  '/application/verification/documents',
  uploadDocument.single('document'),
  validate(uploadDocumentSchema),
  uploadVerificationDocument
);
router.delete('/application/verification/documents/:docId', deleteVerificationDocument);
router.get('/application/verification/documents/:docId/url', getOwnVerificationDocumentUrl);
router.patch('/application/payout', validate(updatePayoutStepSchema), updatePayoutStep);
router.post('/application/submit', submitApplication);

// Everything below requires an approved, non-suspended seller profile.
router.use(requireApprovedSeller);

router.get('/store', getStoreSettings);
router.put('/store', validate(updateStoreSettingsSchema), updateStoreSettings);

router.get('/products', sellerListProducts);
router.post('/products', validate(createProductSchema), sellerCreateProduct);
router.put('/products/:id', validate(updateProductSchema), sellerUpdateProduct);
router.delete('/products/:id', sellerDeleteProduct);
router.post('/products/:id/images', upload.single('image'), sellerUploadProductImage);

router.get('/orders', sellerListOrders);
router.get('/orders/:orderId', sellerGetOrder);
router.patch('/orders/:orderId/items/:itemId/fulfillment', validate(updateFulfillmentStatusSchema), sellerUpdateItemFulfillment);

router.get('/analytics/overview', getSellerAnalytics);
router.get('/transactions', listSellerTransactions);
router.get('/reviews', listSellerProductReviews);

export default router;
