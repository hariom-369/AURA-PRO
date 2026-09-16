import Address from '../models/Address.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getUserAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    res.status(200).json(new ApiResponse(200, addresses, 'Addresses retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req, res, next) => {
  try {
    const { fullName, phone, street, locality, city, state, postalCode, country, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const address = await Address.create({
      user: req.user._id,
      fullName,
      phone,
      street,
      locality,
      city,
      state,
      postalCode,
      country: country || 'India',
      isDefault: isDefault || false
    });

    res.status(201).json(new ApiResponse(201, address, 'Address added successfully'));
  } catch (error) {
    next(error);
  }
};