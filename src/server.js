import 'dotenv/config';
import app from './app.js';
import logger from './config/logger.js';
import { connectDB } from './config/db.js';

const start = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      logger.info('Server started', { port: PORT });
    });
  } catch (err) {
    logger.error('Failed to start server', {
      error: err.message,
    });

    process.exit(1);
  }
};

start();