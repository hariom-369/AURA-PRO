import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Plain profile metadata only — not used for authentication. Optional
    // because a Firebase phone-auth account never supplies one. `sparse`
    // matters because it's no longer true that every document has this field
    // — without it, the *second* user with no email at all would collide
    // with the first on MongoDB's shared "field absent" index entry (the
    // same class of bug fixed for Order.idempotencyKey earlier).
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, default: '', index: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Set only for accounts created via, or claimed through, Firebase Phone
    // Auth. Firebase's own uid is already globally unique per Firebase user,
    // so this is the sole identity anchor for login — the only way a User
    // document can ever authenticate (see docs/FIREBASE_AUTH.md).
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    phoneVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Add missing token generation method
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

export default mongoose.model('User', userSchema);