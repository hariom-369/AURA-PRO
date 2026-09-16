import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
  const adminEmail = process.argv[2];
  const adminPassword = process.argv[3];

  if (!adminEmail || !adminPassword) {
    console.error('Error: Please provide email and password.');
    console.log('Usage: node seeds/seedAdmin.js <email> <password>');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in your .env file');
    }

    await mongoose.connect(mongoUri);

    const existingUser = await User.findOne({ email: adminEmail.toLowerCase() });

    if (existingUser) {
      existingUser.role = 'admin';
      existingUser.password = adminPassword; // Triggers password hash middleware if present in schema
      await existingUser.save();
      console.log(`✓ Upgraded existing user (${adminEmail}) to ADMIN role.`);
    } else {
      await User.create({
        name: 'System Admin',
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        role: 'admin',
        isEmailVerified: true
      });
      console.log(`✓ Created new ADMIN user: ${adminEmail}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed admin account:', err.message);
    process.exit(1);
  }
};

seedAdmin();