import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

/**
 * Recalculates cart monetary figures entirely on backend.
 * All computations use integer minor currency units (Paise).
 */
async function calculateOrderTotal(items, couponCode = null, shippingMethod = 'STANDARD') {
  let subtotalInPaise = 0;
  const verifiedItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId || item.product);
    if (!product || !product.isActive) {
      throw new Error(`Product ${item.name || item.productId} is unavailable.`);
    }

    let unitPriceInPaise = product.basePriceInPaise;
    let selectedSku = product.sku;

    if (product.hasVariants && item.variantSku) {
      const variant = product.variants.find(v => v.sku === item.variantSku);
      if (!variant) throw new Error(`Invalid variant selected for ${product.name}`);
      if (variant.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name} (${variant.name})`);
      unitPriceInPaise = variant.priceInPaise;
      selectedSku = variant.sku;
    } else {
      if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
    }

    const itemTotalInPaise = unitPriceInPaise * item.quantity;
    subtotalInPaise += itemTotalInPaise;

    verifiedItems.push({
      product: product._id,
      name: product.name,
      sku: selectedSku,
      unitPriceInPaise,
      quantity: item.quantity,
      totalInPaise: itemTotalInPaise,
      taxRatePercent: product.taxRatePercent,
      // null = platform-owned, matching Product.seller's own null meaning.
      seller: product.seller || null,
    });
  }

  // Discount Calculation
  let discountInPaise = 0;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (coupon && new Date() <= coupon.expiryDate) {
      if (subtotalInPaise >= coupon.minOrderValueInPaise) {
        if (coupon.discountType === 'PERCENTAGE') {
          discountInPaise = Math.round((subtotalInPaise * coupon.value) / 100);
          if (coupon.maxDiscountInPaise && discountInPaise > coupon.maxDiscountInPaise) {
            discountInPaise = coupon.maxDiscountInPaise;
          }
        } else {
          discountInPaise = coupon.value; // Fixed amount in paise
        }
      }
    }
  }

  // Ensure discount does not exceed subtotal
  discountInPaise = Math.min(discountInPaise, subtotalInPaise);
  const discountedSubtotal = subtotalInPaise - discountInPaise;

  // Shipping Rules (Free shipping above ₹1999 / 199900 paise)
  let shippingInPaise = 0;
  if (shippingMethod === 'EXPRESS') {
    shippingInPaise = 25000; // ₹250
  } else {
    shippingInPaise = discountedSubtotal >= 199900 ? 0 : 9900; // ₹99
  }

  // Tax Calculation (GST 18% applied to discounted subtotal)
  const taxInPaise = Math.round(discountedSubtotal * 0.18);
  const grandTotalInPaise = discountedSubtotal + shippingInPaise + taxInPaise;

  return {
    verifiedItems,
    pricing: {
      subtotalInPaise,
      discountInPaise,
      shippingInPaise,
      taxInPaise,
      grandTotalInPaise,
      currency: 'INR'
    }
  };
}

export { calculateOrderTotal };