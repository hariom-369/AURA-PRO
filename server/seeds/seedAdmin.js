import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

// Promotes an existing account (matched by email) to admin. There is no
// admin self-registration of any kind — the account must already exist
// (register or sign in with Google first), then run this script.
const seedAdmin = async () => {
  const email = process.argv[2];

  if (!email) {
    console.error('Error: Please provide the email of an existing account.');
    console.log('Usage: node seeds/seedAdmin.js <email>');
    console.log('The account must already exist — register (or sign in with Google) with it first.');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in your .env file');
    }

    await mongoose.connect(mongoUri);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error(`No account found with email ${email}. Register (or sign in with Google) with it first, then re-run this script.`);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();
    console.log(`✓ Promoted ${user.name} (${email}) to ADMIN role.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed admin account:', err.message);
    process.exit(1);
  }
};

seedAdmin();
