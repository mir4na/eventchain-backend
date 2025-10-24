const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    logger.info('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('No token provided in authorization header');
      return errorResponse(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7);
    logger.info('Token extracted, length:', token.length);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      logger.info('Token decoded:', JSON.stringify(decoded, null, 2));
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        logger.error('User not found for userId:', decoded.userId);
        return errorResponse(res, 'User not found', 401);
      }

      logger.info('User authenticated:', user.id, user.email, user.role);

      req.user = {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role
      };

      next();
    } catch (err) {
      logger.error('Token verification error:', err.message);
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token expired', 401);
      }
      return errorResponse(res, 'Invalid token', 401);
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return errorResponse(res, 'Authentication failed', 500);
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      logger.error('requireAdmin: No user in request');
      return errorResponse(res, 'Authentication required', 401);
    }

    logger.info('requireAdmin check for user:', req.user.userId, 'role:', req.user.role);

    if (req.user.role !== 'ADMIN') {
      logger.error('requireAdmin: User is not admin, role:', req.user.role);
      return errorResponse(res, 'Admin access required', 403);
    }

    next();
  } catch (error) {
    logger.error('Admin verification error:', error);
    return errorResponse(res, 'Admin verification failed', 500);
  }
};

const requireEO = async (req, res, next) => {
  try {
    if (!req.user) {
      logger.error('requireEO: No user in request');
      return errorResponse(res, 'Authentication required', 401);
    }

    logger.info('requireEO check for user:', req.user.userId, 'role:', req.user.role);

    if (req.user.role !== 'EO' && req.user.role !== 'ADMIN') {
      logger.error('requireEO: User is not EO or ADMIN, role:', req.user.role);
      return errorResponse(res, 'Event organizer access required', 403);
    }

    next();
  } catch (error) {
    logger.error('EO verification error:', error);
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