import express from 'express';
import { createOrderPaymentSession } from '../controllers/paymentController.js';
import {
  createOrder,
  previewOrder,
  getMyOrders,
  getOrderById,
  requestReturn,
  adminListOrders,
  adminUpdateOrderStatus,
  adminApproveReturn,
} from '../controllers/orderController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { checkoutLimiter } from '../middleware/security.js';
import { createOrderSchema, previewOrderSchema, updateOrderStatusSchema, requestReturnSchema } from '../validators/orderValidators.js';

const router = express.Router();

router.get('/admin/all', protect, adminOnly, adminListOrders);
router.patch('/admin/:id/status', protect, adminOnly, validate(updateOrderStatusSchema), adminUpdateOrderStatus);
router.post('/admin/:id/approve-return', protect, adminOnly, adminApproveReturn);

// checkoutLimiter only guards the two endpoints that actually create a charge
// attempt — order creation and Stripe session creation. Everything else on
// this router (preview calculation, order history/detail, returns) is normal
// browsing and must not share that budget.
router.post('/preview', protect, validate(previewOrderSchema), previewOrder);
router.post('/', protect, checkoutLimiter, validate(createOrderSchema), createOrder);
router.get('/myorders', protect, getMyOrders);
router.post('/:id/request-return', protect, validate(requestReturnSchema), requestReturn);
router.post('/:id/pay', protect, checkoutLimiter, createOrderPaymentSession);
router.get('/:id', protect, getOrderById);

export default router;
