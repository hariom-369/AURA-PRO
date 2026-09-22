import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    priceInPaise: { type: Number },
    variantSku: { type: String, default: null },
    sku: { type: String, default: null },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Denormalized from the product at order-creation time (not a live
    // lookup) so it survives a later reassignment/deletion of the product,
    // and so "which seller does this line item belong to" never has to
    // re-derive itself from mutable product state. null = platform-owned,
    // matching Product.seller's null meaning.
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null, index: true },
    // Per-item fulfillment, independent of the order-wide `status` below —
    // a multi-seller order lets each seller progress their own line items
    // without needing to split into separate Order documents or touch
    // Stripe/payment state, which stays order-wide.
    fulfillmentStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
    },
  },
  { _id: true }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    orderItems: [orderItemSchema],

    shippingAddress: {
      fullName: { type: String },
      address: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'IN' },
      phone: { type: String },
    },

    paymentMethod: {
      type: String,
      required: true,
      default: 'Stripe',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      updateTime: { type: String },
      emailAddress: { type: String },
    },
    paymentIntentId: {
      type: String,
      index: true,
      default: null,
    },
    // No `default: null` here deliberately — a sparse unique index only
    // excludes documents where the field is truly absent, not ones where
    // it's explicitly set to null. Mongoose applies defaults eagerly, so a
    // `default: null` would write a literal null into every order, and the
    // second order ever created would collide with the first on that value.
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Integer Paise Prices
    itemsPriceInPaise: { type: Number, default: 0 },
    taxPriceInPaise: { type: Number, default: 0 },
    shippingPriceInPaise: { type: Number, default: 0 },
    discountPriceInPaise: { type: Number, default: 0 },
    totalPriceInPaise: { type: Number, default: 0 },

    // Legacy Decimal Prices
    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    discountPrice: { type: Number, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },

    // Complete Order Lifecycle Status Engine
    status: {
      type: String,
      enum: [
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'PACKED',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'RETURN_REQUESTED',
        'RETURNED',
        'REFUNDED',
      ],
      default: 'PENDING',
    },
    timeline: [timelineSchema],
    trackingNumber: { type: String, default: null },

    // Order Flags & Milestones
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: null },
  },
  { timestamps: true }
);

// Generate unique order number prior to schema validation
orderSchema.pre('validate', function () {
  if (!this.orderNumber) {
    this.orderNumber = `AURA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
});

// Runs pre-validate (not pre-save) because orderItems.price is a required field
// that must be derived from priceInPaise before validation runs.
orderSchema.pre('validate', function () {
  if (this.totalPriceInPaise && !this.totalPrice) {
    this.totalPrice = this.totalPriceInPaise / 100;
  } else if (this.totalPrice && !this.totalPriceInPaise) {
    this.totalPriceInPaise = Math.round(this.totalPrice * 100);
  }

  if (this.itemsPriceInPaise && !this.itemsPrice) {
    this.itemsPrice = this.itemsPriceInPaise / 100;
  } else if (this.itemsPrice && !this.itemsPriceInPaise) {
    this.itemsPriceInPaise = Math.round(this.itemsPrice * 100);
  }

  if (this.taxPriceInPaise && !this.taxPrice) {
    this.taxPrice = this.taxPriceInPaise / 100;
  } else if (this.taxPrice && !this.taxPriceInPaise) {
    this.taxPriceInPaise = Math.round(this.taxPrice * 100);
  }

  if (this.shippingPriceInPaise && !this.shippingPrice) {
    this.shippingPrice = this.shippingPriceInPaise / 100;
  } else if (this.shippingPrice && !this.shippingPriceInPaise) {
    this.shippingPriceInPaise = Math.round(this.shippingPrice * 100);
  }

  if (this.orderItems && this.orderItems.length > 0) {
    this.orderItems.forEach((item) => {
      if (item.priceInPaise && !item.price) {
        item.price = item.priceInPaise / 100;
      } else if (item.price && !item.priceInPaise) {
        item.priceInPaise = Math.round(item.price * 100);
      }
    });
  }

  if (this.paymentStatus === 'Completed' || this.status === 'CONFIRMED') {
    this.isPaid = true;
    if (!this.paidAt) this.paidAt = new Date();
  }

  if (this.status === 'DELIVERED') {
    this.isDelivered = true;
    if (!this.deliveredAt) this.deliveredAt = new Date();
  }

  if (this.isNew && (!this.timeline || this.timeline.length === 0)) {
    this.timeline = [{ status: this.status, timestamp: new Date(), note: 'Order created.' }];
  }
});

orderSchema.index({ user: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;