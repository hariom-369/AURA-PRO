import mongoose from 'mongoose';

const specificationSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true }
}, { _id: false });

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  attributes: { type: Map, of: String },
  priceInPaise: { type: Number, required: true, min: 0 },
  compareAtPriceInPaise: { type: Number, min: 0 },
  stock: { type: Number, required: true, default: 0, min: 0 },
  images: [{ type: String }]
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    brand: { type: String, required: true, default: 'AURA' },
    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    shortDescription: { type: String },

    // Integer minor currency units (paise) for strict backend calculation precision
    basePriceInPaise: { type: Number, required: true, min: 0, index: true },
    compareAtPriceInPaise: { type: Number, default: 0, min: 0 },
    costPriceInPaise: { type: Number, default: 0, min: 0 }, // Admin private margin tracking

    // Legacy standard display fields (synced via pre-save hook)
    price: { type: Number, min: 0, index: true },
    originalPrice: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },

    // Images
    images: [{ type: String, required: true }],
    primaryImage: { type: String },

    // Stock & Variant Engine
    sku: { type: String, sparse: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    hasVariants: { type: Boolean, default: false },
    variants: [variantSchema],

    // Tax / GST Architecture
    taxRatePercent: { type: Number, default: 18 },
    isTaxInclusive: { type: Boolean, default: false },

    // Ratings & Storefront Flags
    rating: { type: Number, default: 0, min: 0, max: 5, index: true },
    numReviews: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // Metadata & SEO
    specifications: [specificationSchema],
    tags: [{ type: String }],
    seoTitle: { type: String },
    seoDescription: { type: String }
  },
  { timestamps: true }
);

// Pre-save middleware to synchronize integer paise values with legacy decimal display fields
productSchema.pre('save', function (next) {
  if (this.basePriceInPaise !== undefined) {
    this.price = this.basePriceInPaise / 100;
  } else if (this.price !== undefined) {
    this.basePriceInPaise = Math.round(this.price * 100);
  }

  if (this.compareAtPriceInPaise !== undefined && this.compareAtPriceInPaise > 0) {
    this.originalPrice = this.compareAtPriceInPaise / 100;
  } else if (this.originalPrice !== undefined && this.originalPrice > 0) {
    this.compareAtPriceInPaise = Math.round(this.originalPrice * 100);
  }

  // Automatic discount percentage calculation
  if (this.compareAtPriceInPaise > this.basePriceInPaise && this.compareAtPriceInPaise > 0) {
    this.discountPercentage = Math.round(
      ((this.compareAtPriceInPaise - this.basePriceInPaise) / this.compareAtPriceInPaise) * 100
    );
  }

  // Fallback for primary image
  if (!this.primaryImage && this.images && this.images.length > 0) {
    this.primaryImage = this.images[0];
  }

  next();
});

productSchema.index({ name: 'text', description: 'text', brand: 'text' });

export default mongoose.model('Product', productSchema);