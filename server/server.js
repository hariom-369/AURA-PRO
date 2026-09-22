import 'dotenv/config'; // Executes immediately prior to importing app.js

import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    // Container orchestrators (Docker, Kubernetes, Render, Railway, etc.) send
    // SIGTERM on redeploy/scale-down — without handling it, in-flight requests
    // get killed abruptly and the MongoDB connection is never closed cleanly.
    const shutdown = (signal) => {
      console.log(`${signal} received: closing server gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('HTTP server and MongoDB connection closed.');
        process.exit(0);
      });

      // Force-exit if connections don't close within 10s.
      setTimeout(() => {
        console.error('Graceful shutdown timed out, forcing exit.');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Database connection failed, server shutting down:', err);
    process.exit(1);
  });
