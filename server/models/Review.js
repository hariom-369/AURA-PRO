import mongoose from 'mongoose';
import Product from './Product.js';

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, default: '' },
    comment: { type: String, required: true, trim: true },
    isVerifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

async function recalculateProductRating(productId) {
  const stats = await mongoose.model('Review').aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  const { avgRating = 0, numReviews = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avgRating * 10) / 10,
    numReviews,
  });
}

reviewSchema.post('save', function (doc) {
  recalculateProductRating(doc.product).catch(() => {});
});

reviewSchema.post('findOneAndDelete', function (doc) {
  if (doc) recalculateProductRating(doc.product).catch(() => {});
});

reviewSchema.post('deleteOne', { document: true, query: false }, function (doc) {
  recalculateProductRating(doc.product).catch(() => {});
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;
