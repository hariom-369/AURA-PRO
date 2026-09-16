import Wishlist from '../models/Wishlist.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }
    res.status(200).json(new ApiResponse(200, wishlist, 'Wishlist retrieved'));
  } catch (error) {
    next(error);
  }
};

export const toggleWishlistItem = async (req, res, next) => {
  try {
    const { productId } = req.body;
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    const index = wishlist.products.indexOf(productId);
    if (index > -1) {
      wishlist.products.splice(index, 1);
    } else {
      wishlist.products.push(productId);
    }

    await wishlist.save();
    await wishlist.populate('products');
    res.status(200).json(new ApiResponse(200, wishlist, 'Wishlist updated'));
  } catch (error) {
    next(error);
  }
};