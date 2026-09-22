import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { buildProductQuery } from '../utils/productQuery.js';
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { generateUniqueSlug } from '../utils/slug.js';

export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 12);
    const skip = (page - 1) * limit;

    const { query, sort } = buildProductQuery({
      search: req.query.search,
      category: req.query.category,
      brand: req.query.brand,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      minRating: req.query.minRating,
      sort: req.query.sort,
    });

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(query)
    ]);

    res.status(200).json(
      new ApiResponse(200, {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Products fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).lean();
    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }
    res.status(200).json(new ApiResponse(200, product, 'Product details retrieved'));
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: create a product
// @route   POST /api/v1/products
export const adminCreateProduct = async (req, res, next) => {
  try {
    const slug = await generateUniqueSlug(Product, req.body.name);
    const product = await Product.create({ ...req.body, slug });
    res.status(201).json(new ApiResponse(201, product, 'Product created'));
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: update a product
// @route   PUT /api/v1/products/:id
export const adminUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found');

    Object.assign(product, req.body);
    if (req.body.name && req.body.name !== product.name) {
      product.slug = await generateUniqueSlug(Product, req.body.name, product._id);
    }
    await product.save();
    res.status(200).json(new ApiResponse(200, product, 'Product updated'));
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: delete a product
// @route   DELETE /api/v1/products/:id
export const adminDeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found');
    res.status(200).json(new ApiResponse(200, null, 'Product deleted'));
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: upload a product image to Cloudinary
// @route   POST /api/v1/products/:id/images
export const adminUploadProductImage = async (req, res, next) => {
  try {
    if (!isCloudinaryConfigured()) {
      throw new ApiError(503, 'Image upload is not configured (missing Cloudinary credentials)');
    }
    if (!req.file) {
      throw new ApiError(400, 'No image file provided');
    }

    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found');

    const cloudinary = getCloudinary();
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aura-pro/products', resource_type: 'image' },
        (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
      );
      stream.end(req.file.buffer);
    });

    product.images.push(result.secure_url);
    if (!product.primaryImage) product.primaryImage = result.secure_url;
    await product.save();

    res.status(200).json(new ApiResponse(200, product, 'Image uploaded'));
  } catch (error) {
    next(error);
  }
};