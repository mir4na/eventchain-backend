const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const blockchainService = require('../services/blockchainService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Get user tickets
const getUserTickets = async (req, res) => {
  try {
    const { address } = req.params;
    const { status } = req.query;

    const where = { currentOwner: address };
    if (status === 'used') where.isUsed = true;
    else if (status === 'active') where.isUsed = false;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            eventName: true,
            eventURI: true,
            eventDate: true,
            location: true
          }
        },
        ticketType: {
          select: {
            id: true,
            typeName: true,
            price: true
          }
        }
      },
      orderBy: { mintedAt: 'desc' }
    });

    return successResponse(res, { tickets });

  } catch (error) {
    logger.error('Error fetching user tickets:', error);
    return errorResponse(res, 'Failed to fetch user tickets', 500);
  }
};

// Get ticket by ID
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(id) },
      include: {
        event: {
          select: {
            id: true,
            eventName: true,
            eventURI: true,
            eventDate: true,
            location: true,
            eventCreator: true
          }
        },
        ticketType: {
          select: {
            id: true,
            typeName: true,
            price: true,
            description: true
          }
        },
        transactions: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }

    // Get blockchain info
    const blockchainInfo = await blockchainService.getTicketInfo(ticket.ticketId);
    const canResell = await blockchainService.canResell(ticket.ticketId);
    const maxResalePrice = await blockchainService.getMaxResalePrice(ticket.ticketId);

    return successResponse(res, {
      ...ticket,
      blockchainInfo,
      canResell,
      maxResalePrice
    });

  } catch (error) {
    logger.error('Error fetching ticket:', error);
    return errorResponse(res, 'Failed to fetch ticket', 500);
  }
};

// List ticket for resale
const listForResale = async (req, res) => {
  try {
    const { ticketId, resalePrice, resaleDeadline } = req.body;
    const sellerAddress = req.user.address;

    // Verify ticket ownership
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) }
    });

    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }

    if (ticket.currentOwner !== sellerAddress) {
      return errorResponse(res, 'Not authorized to resell this ticket', 403);
    }

    if (ticket.isUsed) {
      return errorResponse(res, 'Cannot resell used ticket', 400);
    }

    if (ticket.isForResale) {
      return errorResponse(res, 'Ticket already listed for resale', 400);
    }

    // Check resale eligibility
    const canResell = await blockchainService.canResell(ticket.ticketId);
    if (!canResell) {
      return errorResponse(res, 'Ticket cannot be resold', 400);
    }

    // Validate resale price
    const maxPrice = await blockchainService.getMaxResalePrice(ticket.ticketId);
    const priceInWei = ethers.parseEther(resalePrice.toString());
    
    if (priceInWei > BigInt(maxPrice)) {
      return errorResponse(res, 'Resale price exceeds maximum allowed', 400);
    }

    // List on blockchain
    const result = await blockchainService.listForResale(
      ticket.ticketId,
      priceInWei.toString(),
      Math.floor(new Date(resaleDeadline).getTime() / 1000)
    );

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        isForResale: true,
        resalePrice: priceInWei.toString(),
        resaleDeadline: new Date(resaleDeadline)
      }
    });

    logger.info(`Ticket listed for resale: ${ticketId} by ${sellerAddress}`);

    return successResponse(res, {
      message: 'Ticket listed for resale successfully',
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Error listing ticket for resale:', error);
    return errorResponse(res, 'Failed to list ticket for resale', 500);
  }
};

// Buy resale ticket
const buyResaleTicket = async (req, res) => {
  try {
    const { ticketId, buyerAddress } = req.body;

    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) }
    });

    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }

    if (!ticket.isForResale) {
      return errorResponse(res, 'Ticket not available for resale', 400);
    }

    if (ticket.isUsed) {
      return errorResponse(res, 'Ticket already used', 400);
    }

    if (new Date() > ticket.resaleDeadline) {
      return errorResponse(res, 'Resale deadline passed', 400);
    }

    // Buy on blockchain
    const result = await blockchainService.buyResaleTicket(
      ticket.ticketId,
      ticket.resalePrice
    );

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        currentOwner: buyerAddress,
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null,
        resaleCount: { increment: 1 }
      }
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        txHash: result.txHash,
        type: 'TICKET_RESALE',
        from: ticket.currentOwner,
        to: buyerAddress,
        ticketId: ticket.ticketId,
        amount: ticket.resalePrice,
        status: 'CONFIRMED',
        timestamp: new Date()
      }
    });

    logger.info(`Resale ticket purchased: ${ticketId} by ${buyerAddress}`);

    return successResponse(res, {
      message: 'Ticket purchased successfully',
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Error buying resale ticket:', error);
    return errorResponse(res, 'Failed to buy resale ticket', 500);
  }
};

// Cancel resale listing
const cancelResaleListing = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const sellerAddress = req.user.address;

    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) }
    });

    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }

    if (ticket.currentOwner !== sellerAddress) {
      return errorResponse(res, 'Not authorized to cancel this listing', 403);
    }

    if (!ticket.isForResale) {
      return errorResponse(res, 'Ticket not listed for resale', 400);
    }

    // Cancel on blockchain
    const result = await blockchainService.cancelResaleListing(ticket.ticketId);

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null
      }
    });

    logger.info(`Resale listing cancelled: ${ticketId} by ${sellerAddress}`);

    return successResponse(res, {
      message: 'Resale listing cancelled successfully',
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Error cancelling resale listing:', error);
    return errorResponse(res, 'Failed to cancel resale listing', 500);
  }
};

// Get resale tickets
const getResaleTickets = async (req, res) => {
  try {
    const { eventId, minPrice, maxPrice } = req.query;

    const where = {
      isForResale: true,
      isUsed: false,
      resaleDeadline: { gt: new Date() }
    };

    if (eventId) where.eventId = parseInt(eventId);
    if (minPrice) where.resalePrice = { gte: ethers.parseEther(minPrice).toString() };
    if (maxPrice) where.resalePrice = { lte: ethers.parseEther(maxPrice).toString() };

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            eventName: true,
            eventURI: true,
            eventDate: true,
            location: true
          }
        },
        ticketType: {
          select: {
            id: true,
            typeName: true,
            price: true
          }
        }
      },
      orderBy: { resalePrice: 'asc' }
    });

    return successResponse(res, { tickets });

  } catch (error) {
    logger.error('Error fetching resale tickets:', error);
    return errorResponse(res, 'Failed to fetch resale tickets', 500);
  }
};

// Use ticket (for event organizers)
const useTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const eventCreator = req.user.address;

    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) },
      include: { event: true }
    });

    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }

    if (ticket.event.eventCreator !== eventCreator) {
      return errorResponse(res, 'Not authorized to use this ticket', 403);
    }

    if (ticket.isUsed) {
      return errorResponse(res, 'Ticket already used', 400);
    }

    // Use on blockchain
    const result = await blockchainService.useTicket(ticket.ticketId);

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        isUsed: true,
        usedAt: new Date()
      }
    });

    logger.info(`Ticket used: ${ticketId} by ${eventCreator}`);

    return successResponse(res, {
      message: 'Ticket used successfully',
      txHash: result.txHash
    });

  } catch (error) {
    logger.error('Error using ticket:', error);
    return errorResponse(res, 'Failed to use ticket', 500);
  }
};

// Get ticket transaction history
const getTicketHistory = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const transactions = await prisma.transaction.findMany({
      where: { ticketId: parseInt(ticketId) },
      orderBy: { timestamp: 'desc' }
    });

    return successResponse(res, { transactions });

  } catch (error) {
    logger.error('Error fetching ticket history:', error);
    return errorResponse(res, 'Failed to fetch ticket history', 500);
  }
};

module.exports = {
  getUserTickets,
  getTicketById,
  listForResale,
  buyResaleTicket,
  cancelResaleListing,
  getResaleTickets,
  useTicket,
  getTicketHistory
};
