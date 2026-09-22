import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['SIGNUP_VERIFICATION', 'LOGIN', 'PASSWORD_RESET'], required: true },
    // Never store the plaintext code — only a SHA-256 hash of it.
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL index — MongoDB automatically deletes the document once expiresAt passes,
// so expired/used OTPs don't accumulate.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', otpSchema);
