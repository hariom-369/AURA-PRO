const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
  value: { type: Number, required: true }, // Percentage (e.g. 15) or Paise amount
  minOrderValueInPaise: { type: Number, default: 0 },
  maxDiscountInPaise: { type: Number }, // Cap for percentage discounts
  expiryDate: { type: Date, required: true },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);