import { logger } from '../config/logger.js';

const errorHandler = (err, req, res, next) => {

//force to everything
console.log('FULL ERROR:', err); // temporary — logs everything
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });


  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      issues: (err.issues || err.errors || []).map(e => ({
        field: Array.isArray(e.path) ? e.path.join('.') : e.path || 'root',
        message: e.message,
      })),
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};

export default errorHandler;