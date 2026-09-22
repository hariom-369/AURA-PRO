import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantSku: {
      type: String,
      trim: true,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    // Unit price in paise for backend calculation precision
    priceInPaise: {
      type: Number,
      default: 0,
    },
    // Legacy display price field
    price: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    // Sparse index allows guest users (null) without triggering unique constraint errors
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true,
      default: null,
    },
    // Session identifier for unauthenticated guest carts
    sessionId: {
      type: String,
      index: true,
      default: null,
    },
    items: [cartItemSchema],
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    // Total price in paise (integer units)
    totalPriceInPaise: {
      type: Number,
      default: 0,
    },
    // Legacy total price field
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to synchronize integer paise with display prices
cartSchema.pre('save', function () {
  if (this.items && this.items.length > 0) {
    this.items.forEach((item) => {
      if (item.priceInPaise && !item.price) {
        item.price = item.priceInPaise / 100;
      } else if (item.price && !item.priceInPaise) {
        item.priceInPaise = Math.round(item.price * 100);
      }
    });
  }
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;