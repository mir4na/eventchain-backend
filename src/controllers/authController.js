const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '7d';

class AuthController {
  async login(req, res) {
    try {
      const { address, signature, message } = req.body;

      if (!address || !signature || !message) {
        return errorResponse(res, 'Missing required fields', 400);
      }

      if (!ethers.isAddress(address)) {
        return errorResponse(res, 'Invalid address', 400);
      }

      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          return errorResponse(res, 'Invalid signature', 401);
        }
      } catch (error) {
        return errorResponse(res, 'Signature verification failed', 401);
      }

      let user = await prisma.user.findUnique({
        where: { walletAddress: address.toLowerCase() }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            walletAddress: address.toLowerCase(),
            role: 'USER'
          }
        });
        logger.info(`New user registered: ${address}`);
      }

      const token = jwt.sign(
        { 
          userId: user.id,
          address: user.walletAddress,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      await prisma.walletHistory.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          details: {
            timestamp: new Date().toISOString(),
            ip: req.ip
          }
        }
      });

      return successResponse(res, {
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          role: user.role
        }
      }, 'Login successful');
    } catch (error) {
      logger.error('Login error:', error);
      return errorResponse(res, 'Login failed', 500);
    }
  }

  async logout(req, res) {
    try {
      const { userId } = req.user;

      await prisma.walletHistory.create({
        data: {
          userId,
          action: 'LOGOUT',
          details: {
            timestamp: new Date().toISOString(),
            ip: req.ip
          }
        }
      });

      logger.info(`User logged out: ${req.user.address}`);
      return successResponse(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      return errorResponse(res, 'Logout failed', 500);
    }
  }

  async verifyToken(req, res) {
    try {
      const { userId, address, role } = req.user;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          walletAddress: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      return successResponse(res, { user }, 'Token valid');
    } catch (error) {
      logger.error('Token verification error:', error);
      return errorResponse(res, 'Token verification failed', 500);
    }
  }

  async getNonce(req, res) {
    try {
      const { address } = req.params;

      if (!ethers.isAddress(address)) {
        return errorResponse(res, 'Invalid address', 400);
      }

      const nonce = Math.floor(Math.random() * 1000000);
      const timestamp = Date.now();
      const message = `Sign this message to authenticate with MyMineTicketKu\n\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

      return successResponse(res, { 
        message,
        nonce,
        timestamp 
      }, 'Nonce generated');
    } catch (error) {
      logger.error('Nonce generation error:', error);
      return errorResponse(res, 'Failed to generate nonce', 500);
    }
  }

  async checkAdmin(req, res) {
    try {
      const { address } = req.params;

      if (!ethers.isAddress(address)) {
        return errorResponse(res, 'Invalid address', 400);
      }

      const admin = await prisma.admin.findUnique({
        where: { 
          address: address.toLowerCase(),
          active: true
        }
      });

      return successResponse(res, { 
        isAdmin: !!admin 
      }, 'Admin check completed');
    } catch (error) {
      logger.error('Admin check error:', error);
      return errorResponse(res, 'Admin check failed', 500);
    }
  }
}

module.exports = new AuthController();