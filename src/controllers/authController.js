const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '7d';

class AuthController {
  async register(req, res) {
    try {
      const { username, email, password, role } = req.body;

      if (!username || !email || !password) {
        return errorResponse(res, 'Username, email, and password are required', 400);
      }

      const userRole = role === 'EO' ? 'EO' : 'USER';

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { name: username }
          ]
        }
      });

      if (existingUser) {
        return errorResponse(res, 'User with this email or username already exists', 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name: username,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: userRole,
          walletAddress: ''
        }
      });

      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      await prisma.walletHistory.create({
        data: {
          userId: user.id,
          action: 'REGISTER',
          details: {
            timestamp: new Date().toISOString(),
            ip: req.ip
          }
        }
      });

      logger.info(`New user registered: ${username}`);

      return successResponse(res, {
        token,
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress || null
        }
      }, 'Registration successful');
    } catch (error) {
      logger.error('Registration error:', error);
      return errorResponse(res, 'Registration failed', 500);
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return errorResponse(res, 'Email and password are required', 400);
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user || !user.password) {
        return errorResponse(res, 'Invalid email or password', 401);
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return errorResponse(res, 'Invalid email or password', 401);
      }

      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
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

      logger.info(`User logged in: ${email}`);

      return successResponse(res, {
        token,
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress || null
        }
      }, 'Login successful');
    } catch (error) {
      logger.error('Login error:', error);
      return errorResponse(res, 'Login failed', 500);
    }
  }

  async connectWallet(req, res) {
    try {
      const { walletAddress, signature, message } = req.body;
      const { userId } = req.user;

      if (!walletAddress || !signature || !message) {
        return errorResponse(res, 'Missing required fields', 400);
      }

      if (!ethers.isAddress(walletAddress)) {
        return errorResponse(res, 'Invalid wallet address', 400);
      }

      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          return errorResponse(res, 'Invalid signature', 401);
        }
      } catch (error) {
        return errorResponse(res, 'Signature verification failed', 401);
      }

      const existingWallet = await prisma.user.findFirst({
        where: {
          walletAddress: walletAddress.toLowerCase(),
          id: { not: userId }
        }
      });

      if (existingWallet) {
        return errorResponse(res, 'Wallet already connected to another account', 400);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          walletAddress: walletAddress.toLowerCase()
        }
      });

      await prisma.walletHistory.create({
        data: {
          userId: user.id,
          action: 'WALLET_CONNECTED',
          details: {
            walletAddress: walletAddress.toLowerCase(),
            timestamp: new Date().toISOString(),
            ip: req.ip
          }
        }
      });

      logger.info(`Wallet connected for user ${userId}: ${walletAddress}`);

      return successResponse(res, {
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress
        }
      }, 'Wallet connected successfully');
    } catch (error) {
      logger.error('Wallet connection error:', error);
      return errorResponse(res, 'Failed to connect wallet', 500);
    }
  }

  async disconnectWallet(req, res) {
    try {
      const { userId } = req.user;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          walletAddress: ''
        }
      });

      await prisma.walletHistory.create({
        data: {
          userId: user.id,
          action: 'WALLET_DISCONNECTED',
          details: {
            timestamp: new Date().toISOString(),
            ip: req.ip
          }
        }
      });

      logger.info(`Wallet disconnected for user ${userId}`);

      return successResponse(res, null, 'Wallet disconnected successfully');
    } catch (error) {
      logger.error('Wallet disconnection error:', error);
      return errorResponse(res, 'Failed to disconnect wallet', 500);
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

      logger.info(`User logged out: ${userId}`);
      return successResponse(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      return errorResponse(res, 'Logout failed', 500);
    }
  }

  async verifyToken(req, res) {
    try {
      const { userId } = req.user;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          walletAddress: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      return successResponse(res, { 
        user: {
          id: user.id,
          username: user.name,
          email: user.email,
          walletAddress: user.walletAddress || null,
          role: user.role
        }
      }, 'Token valid');
    } catch (error) {
      logger.error('Token verification error:', error);
      return errorResponse(res, 'Token verification failed', 500);
    }
  }

  async getWalletNonce(req, res) {
    try {
      const { address } = req.params;

      if (!ethers.isAddress(address)) {
        return errorResponse(res, 'Invalid address', 400);
      }

      const nonce = Math.floor(Math.random() * 1000000);
      const timestamp = Date.now();
      const message = `Connect wallet to MyMineTicketKu\n\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

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