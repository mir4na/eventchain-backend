const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Create or get user
const createOrGetUser = async (req, res) => {
  try {
    const { address, role = 'BUYER' } = req.body;

    let user = await prisma.user.findUnique({
      where: { address }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          address,
          role
        }
      });
      logger.info(`New user created: ${address} with role ${role}`);
    }

    return successResponse(res, { user });

  } catch (error) {
    logger.error('Error creating/getting user:', error);
    return errorResponse(res, 'Failed to create/get user', 500);
  }
};

// Get user by address
const getUserByAddress = async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { address },
      include: {
        _count: {
          select: {
            events: true,
            tickets: true,
            transactions: true,
            favorites: true
          }
        }
      }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, { user });

  } catch (error) {
    logger.error('Error fetching user:', error);
    return errorResponse(res, 'Failed to fetch user', 500);
  }
};

// Get user transaction history
const getUserTransactionHistory = async (req, res) => {
  try {
    const { address } = req.params;
    const { type, eventId, page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { from: address };
    
    if (type) where.type = type;
    if (eventId) where.eventId = parseInt(eventId);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              eventName: true,
              eventURI: true
            }
          },
          ticket: {
            select: {
              ticketId: true,
              ticketType: {
                select: {
                  typeName: true
                }
              }
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.transaction.count({ where })
    ]);

    return successResponse(res, {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching user transaction history:', error);
    return errorResponse(res, 'Failed to fetch transaction history', 500);
  }
};

// Get user favorites
const getUserFavorites = async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { address }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        event: {
          include: {
            ticketTypes: true,
            _count: {
              select: { tickets: true, favorites: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, { favorites });

  } catch (error) {
    logger.error('Error fetching user favorites:', error);
    return errorResponse(res, 'Failed to fetch favorites', 500);
  }
};

// Update user role (admin function)
const updateUserRole = async (req, res) => {
  try {
    const { address } = req.params;
    const { role } = req.body;

    const user = await prisma.user.findUnique({
      where: { address }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    await prisma.user.update({
      where: { address },
      data: { role }
    });

    logger.info(`User role updated: ${address} to ${role}`);

    return successResponse(res, {
      message: 'User role updated successfully'
    });

  } catch (error) {
    logger.error('Error updating user role:', error);
    return errorResponse(res, 'Failed to update user role', 500);
  }
};

// Get user wallet history
const getUserWalletHistory = async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { address }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const walletHistory = await prisma.walletHistory.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' }
    });

    return successResponse(res, { walletHistory });

  } catch (error) {
    logger.error('Error fetching wallet history:', error);
    return errorResponse(res, 'Failed to fetch wallet history', 500);
  }
};

// Add wallet history entry
const addWalletHistory = async (req, res) => {
  try {
    const { address, action, details } = req.body;

    const user = await prisma.user.findUnique({
      where: { address }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    await prisma.walletHistory.create({
      data: {
        userId: user.id,
        action,
        details
      }
    });

    return successResponse(res, {
      message: 'Wallet history entry added successfully'
    });

  } catch (error) {
    logger.error('Error adding wallet history:', error);
    return errorResponse(res, 'Failed to add wallet history', 500);
  }
};

module.exports = {
  createOrGetUser,
  getUserByAddress,
  getUserTransactionHistory,
  getUserFavorites,
  updateUserRole,
  getUserWalletHistory,
  addWalletHistory
};
