import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

// Firebase Phone Auth is the only sign-in method, so there is no email/
// password to seed. Promotes an existing account (matched by phone number,
// exactly as stored — the same value Firebase reports as `phone_number`,
// e.g. "+15551234567") to admin. The account must already exist — sign in
// with that phone number once first so `findOrCreateUserFromFirebase`
// creates it, then run this script.
const seedAdmin = async () => {
  const phone = process.argv[2];

  if (!phone) {
    console.error('Error: Please provide the phone number of an existing account.');
    console.log('Usage: node seeds/seedAdmin.js <phone-number>');
    console.log('The phone number must match exactly what Firebase reports (e.g. +15551234567),');
    console.log('and the account must already exist — sign in with it once first.');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in your .env file');
    }

    await mongoose.connect(mongoUri);

    const user = await User.findOne({ phone });
    if (!user) {
      console.error(`No account found with phone number ${phone}. Sign in with it once first, then re-run this script.`);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();
    console.log(`✓ Promoted ${user.name} (${phone}) to ADMIN role.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed admin account:', err.message);
    process.exit(1);
  }
};

seedAdmin();
