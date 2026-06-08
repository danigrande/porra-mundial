import mongoose from 'mongoose';

export const createResponse = (status, data = null, message = null) => {
  return { status, data, message };
};

export const dbCheck = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') return next();
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json(createResponse('error', null, 'La base de datos no está conectada. Revisa MONGODB_URI en Render.'));
    }
    next();
};
