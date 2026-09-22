import express from 'express';
import {
  getProducts,
  getProductBySlug,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUploadProductImage,
} from '../controllers/productController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '../validators/productValidators.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.get('/', getProducts);

router.post('/', protect, adminOnly, validate(createProductSchema), adminCreateProduct);
router.put('/:id', protect, adminOnly, validate(updateProductSchema), adminUpdateProduct);
router.delete('/:id', protect, adminOnly, adminDeleteProduct);
router.post('/:id/images', protect, adminOnly, upload.single('image'), adminUploadProductImage);

router.get('/:slug', getProductBySlug);

export default router;
