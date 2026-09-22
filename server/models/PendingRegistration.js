import mongoose from 'mongoose';

// Holds registration details (already-hashed password included) for an
// account that has submitted the signup form but not yet verified its email.
// No User document exists until verification succeeds — this collection is
// the only trace of an in-progress signup, and it self-expires via the TTL
// index below if the user never completes verification.
const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Already bcrypt-hashed at creation time — never the plaintext password.
    passwordHash: { type: String, required: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    // Overall abandonment TTL — longer than the OTP's own validity window so
    // a resend doesn't require re-entering the whole form.
    discardAt: { type: Date, required: true },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ discardAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PendingRegistration', pendingRegistrationSchema);
