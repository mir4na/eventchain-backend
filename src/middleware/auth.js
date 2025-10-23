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
      
      req.user = {
        userId: decoded.userId,
        address: decoded.address,
        role: decoded.role
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

    const admin = await prisma.admin.findUnique({
      where: { 
        address: req.user.address.toLowerCase(),
        active: true
      }
    });

    if (!admin) {
      return errorResponse(res, 'Admin access required', 403);
    }

    req.admin = admin;
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
        req.user = {
          userId: decoded.userId,
          address: decoded.address,
          role: decoded.role
        };
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