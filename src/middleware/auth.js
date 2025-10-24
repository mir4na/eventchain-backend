const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { errorResponse } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 401);
      }

      req.user = {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token expired', 401);
      }
      return errorResponse(res, 'Invalid token', 401);
    }
  } catch (error) {
    return errorResponse(res, 'Authentication failed', 500);
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role !== 'ADMIN') {
      return errorResponse(res, 'Admin access required', 403);
    }

    next();
  } catch (error) {
    return errorResponse(res, 'Admin verification failed', 500);
  }
};

const requireEO = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role !== 'EO' && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'Event organizer access required', 403);
    }

    next();
  } catch (error) {
    return errorResponse(res, 'Authorization failed', 500);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId }
        });

        if (user) {
          req.user = {
            userId: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
            role: user.role
          };
        }
      } catch (err) {
        req.user = null;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireEO,
  optionalAuth
};