import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Required for a normal (email/password or Google) account. Optional
    // for a legacy Firebase phone-auth account, which never had one —
    // `firebaseUid` fields are kept dormant/untouched on those documents
    // rather than deleted (no destructive migration), they just have no
    // login path under the new system. `sparse` matters because it's not
    // true that every document has this field — without it, the *second*
    // user with no email at all would collide with the first on MongoDB's
    // shared "field absent" unique-index entry.
    email: {
      type: String,
      required: function () { return !this.firebaseUid; },
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // select: false — never returned by a plain find()/findById(); every
    // read that needs it must opt in with .select('+password'). Required
    // unless the account is Google-only or a legacy Firebase account.
    password: {
      type: String,
      select: false,
      required: function () { return !this.googleId && !this.firebaseUid; },
    },
    // Set once a Google identity has been verified server-side and either
    // created this account or been linked to it. An account can have a
    // password, a googleId, both, or (for a legacy account) neither.
    googleId: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, default: '', index: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Password-reset: only ever the SHA-256 hash of the real token is
    // stored (server/services/passwordResetService.js) — the real token is
    // never persisted anywhere, only emailed once. select: false since
    // nothing should ever accidentally return these over the API.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Legacy Firebase Phone Auth fields — no longer written by any current
    // code path, kept only so existing documents (and their order/seller
    // history) remain valid and undamaged. See docs/AUTHENTICATION.md.
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    phoneVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ARGON2ID_PREFIX = '$argon2id$';

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  // Already an Argon2id hash (e.g. re-saving a document that didn't touch
  // the password field through a path that still marks it modified) —
  // hashing it again would hash the hash, and no real password would ever
  // verify against it again.
  if (this.password.startsWith(ARGON2ID_PREFIX)) return;
  this.password = await argon2Hash(this.password);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return argon2Verify(this.password, enteredPassword);
};

// `expiresIn` lets a "remember me"-unchecked login issue a short-lived
// token (stored in sessionStorage, cleared on tab close) instead of the
// default long-lived one (stored in localStorage) — see AuthContext.jsx.
userSchema.methods.generateAuthToken = function (expiresIn = '30d') {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

export default mongoose.model('User', userSchema);
