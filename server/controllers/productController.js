import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 12);
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    if (req.query.category && req.query.category !== 'All') {
      query.category = { $regex: new RegExp(`^${req.query.category}$`, 'i') };
    }

    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }

    if (req.query.minRating) {
      query.rating = { $gte: Number(req.query.minRating) };
    }

    let sort = {};
    switch (req.query.sort) {
      case 'price-low': sort = { price: 1 }; break;
      case 'price-high': sort = { price: -1 }; break;
      case 'newest': sort = { createdAt: -1 }; break;
      case 'rating': sort = { rating: -1 }; break;
      default: sort = { createdAt: -1 };
    }

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