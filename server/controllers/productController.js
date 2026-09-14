import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get all products (with pagination & search)
// @route   GET /api/v1/products
export const getProducts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const keyword = req.query.keyword
    ? { name: { $regex: req.query.keyword, $options: 'i' } }
    : {};

  const count = await Product.countDocuments({ ...keyword });
  const products = await Product.find({ ...keyword })
    .limit(limit)
    .skip(limit * (page - 1));

  res.status(200).json(
    new ApiResponse(
      200,
      {
        products,
        page,
        pages: Math.ceil(count / limit),
        total: count,
      },
      'Products fetched successfully'
    )
  );
});

// @desc    Get single product by ID
// @route   GET /api/v1/products/:id
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  res
    .status(200)
    .json(new ApiResponse(200, product, 'Product fetched successfully'));
});

// @desc    Create new product (Admin only)
// @route   POST /api/v1/products
export const createProduct = asyncHandler(async (req, res) => {
  const { name, price, description, category, stock, imageUrl } = req.body;

  const product = await Product.create({
    user: req.user._id,
    name,
    price,
    description,
    category,
    stock,
    imageUrl,
  });

  res
    .status(201)
    .json(new ApiResponse(201, product, 'Product created successfully'));
});

// @desc    Update product (Admin only)
// @route   PUT /api/v1/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res
    .status(200)
    .json(new ApiResponse(200, updatedProduct, 'Product updated successfully'));
});

// @desc    Delete product (Admin only)
// @route   DELETE /api/v1/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  await product.deleteOne();

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Product deleted successfully'));
});