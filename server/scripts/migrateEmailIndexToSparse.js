// One-time migration: the User.email unique index predates Firebase phone
// auth and was never `sparse`. Every existing user has a real email today,
// so this changes nothing about current data or behavior — it only matters
// once a phone-only account (no email field at all) is created, at which
// point a second phone-only user would otherwise collide with the first on
// MongoDB's shared "field absent" index entry (the same bug class fixed for
// Order.idempotencyKey earlier in this project).
//
// Safe to run multiple times (idempotent) and safe to run before or after
// deploying the code that adds firebaseUid — it only touches the index
// definition, never any document.
//
// Usage:
//   cd server
//   node scripts/migrateEmailIndexToSparse.js
import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.db.collection('users');

  const indexes = await collection.indexes();
  const emailIndex = indexes.find((i) => i.name === 'email_1');

  if (!emailIndex) {
    console.log('No email_1 index found — nothing to do (Mongoose will create the sparse version on next connect).');
  } else if (emailIndex.sparse) {
    console.log('email_1 index is already sparse — nothing to do.');
  } else {
    console.log('Dropping non-sparse email_1 index...');
    await collection.dropIndex('email_1');
    console.log('Creating sparse unique email_1 index...');
    await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('Done. email_1 is now unique + sparse.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
