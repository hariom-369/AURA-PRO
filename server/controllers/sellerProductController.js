import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateUniqueSlug } from '../utils/slug.js';
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

// req.body has already passed through productValidators' createProductSchema/
// updateProductSchema (see sellerRoutes.js) — neither schema defines a
// `seller` field, so Zod's default "strip unknown keys" behavior means a
// seller can never smuggle another seller's id into their own product via
// the request body. `seller` is only ever set here, from req.seller._id.
async function loadOwnProduct(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.seller || product.seller.toString() !== req.seller._id.toString()) {
    throw new ApiError(403, 'You do not have access to this product');
  }
  return product;
}

// @desc    Seller: list only their own products
// @route   GET /api/v1/seller/products
export const sellerListProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = { seller: req.seller._id };

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, { products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Your products retrieved')
  );
});

// @desc    Seller: create a product under their own store
// @route   POST /api/v1/seller/products
export const sellerCreateProduct = asyncHandler(async (req, res) => {
  const slug = await generateUniqueSlug(Product, req.body.name);
  const product = await Product.create({ ...req.body, slug, seller: req.seller._id });
  res.status(201).json(new ApiResponse(201, product, 'Product created'));
});

// @desc    Seller: update one of their own products
// @route   PUT /api/v1/seller/products/:id
export const sellerUpdateProduct = asyncHandler(async (req, res) => {
  const product = await loadOwnProduct(req);
  Object.assign(product, req.body);
  if (req.body.name && req.body.name !== product.name) {
    product.slug = await generateUniqueSlug(Product, req.body.name, product._id);
  }
  await product.save();
  res.status(200).json(new ApiResponse(200, product, 'Product updated'));
});

// @desc    Seller: delete one of their own products
// @route   DELETE /api/v1/seller/products/:id
export const sellerDeleteProduct = asyncHandler(async (req, res) => {
  const product = await loadOwnProduct(req);
  await product.deleteOne();
  res.status(200).json(new ApiResponse(200, null, 'Product deleted'));
});

// @desc    Seller: upload a product image to Cloudinary
// @route   POST /api/v1/seller/products/:id/images
export const sellerUploadProductImage = asyncHandler(async (req, res) => {
  const product = await loadOwnProduct(req);
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'Image upload is not configured (missing Cloudinary credentials)');
  }
  if (!req.file) throw new ApiError(400, 'No image file provided');

  const cloudinary = getCloudinary();
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'aura-pro/seller-products', resource_type: 'image' },
      (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
    );
    stream.end(req.file.buffer);
  });

  product.images.push(result.secure_url);
  if (!product.primaryImage) product.primaryImage = result.secure_url;
  await product.save();

  res.status(200).json(new ApiResponse(200, product, 'Image uploaded'));
});
