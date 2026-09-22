import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — mongoose will attempt to reconnect.'));
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;