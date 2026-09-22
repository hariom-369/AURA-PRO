import express from 'express';
import { getAnalyticsOverview, getLowStockProducts } from '../controllers/analyticsController.js';
import { adminListUsers, adminUpdateUserRole, adminUpdateUserStatus } from '../controllers/userController.js';
import { adminListCoupons, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon } from '../controllers/couponController.js';
import {
  adminListSellers,
  adminGetSeller,
  adminGetSellerDocumentUrl,
  adminUpdateSellerStatus,
} from '../controllers/adminSellerController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { updateUserRoleSchema, updateUserStatusSchema } from '../validators/userValidators.js';
import { createCouponSchema, updateCouponSchema } from '../validators/couponValidators.js';
import { adminListSellersSchema, adminUpdateSellerStatusSchema } from '../validators/sellerValidators.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/analytics/overview', getAnalyticsOverview);
router.get('/products/low-stock', getLowStockProducts);

router.get('/users', adminListUsers);
router.patch('/users/:id/role', validate(updateUserRoleSchema), adminUpdateUserRole);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminUpdateUserStatus);

router.get('/coupons', adminListCoupons);
router.post('/coupons', validate(createCouponSchema), adminCreateCoupon);
router.patch('/coupons/:id', validate(updateCouponSchema), adminUpdateCoupon);
router.delete('/coupons/:id', adminDeleteCoupon);

router.get('/sellers', validate(adminListSellersSchema, 'query'), adminListSellers);
router.get('/sellers/:id', adminGetSeller);
router.get('/sellers/:id/documents/:docId/url', adminGetSellerDocumentUrl);
router.patch('/sellers/:id/status', validate(adminUpdateSellerStatusSchema), adminUpdateSellerStatus);

export default router;
