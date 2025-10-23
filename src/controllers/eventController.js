const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const blockchainService = require('../services/blockchainService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Create event (EO function)
const createEvent = async (req, res) => {
  try {
    const {
      eventName,
      eventURI,
      documentURI,
      description,
      location,
      eventDate,
      revenueBeneficiaries,
      percentages
    } = req.body;

    const eventCreator = req.user.address;

    // Validate revenue shares
    if (revenueBeneficiaries.length !== percentages.length) {
      return errorResponse(res, 'Revenue beneficiaries and percentages must have same length', 400);
    }

    const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
    if (totalPercentage !== 10000) { // 100% in basis points
      return errorResponse(res, 'Total percentage must equal 100%', 400);
    }

    // Create event in database
    const event = await prisma.event.create({
      data: {
        eventId: 0, // Will be updated after approval
        eventCreator,
        eventName,
        eventURI,
        documentURI,
        description,
        location,
        eventDate: new Date(eventDate),
        eventActive: false,
        status: 'PENDING',
        createdAt: new Date(),
        txHash: 'pending'
      }
    });

    // Create revenue shares
    const revenueShares = revenueBeneficiaries.map((beneficiary, index) => ({
      eventId: event.id,
      beneficiary,
      percentage: percentages[index]
    }));

    await prisma.revenueShare.createMany({
      data: revenueShares
    });

    logger.info(`Event created: ${event.id} by ${eventCreator}`);

    return successResponse(res, {
      eventId: event.id,
      message: 'Event created successfully. Waiting for admin approval.'
    }, 201);

  } catch (error) {
    logger.error('Error creating event:', error);
    return errorResponse(res, 'Failed to create event', 500);
  }
};

// Get all events with filters
const getEvents = async (req, res) => {
  try {
    const {
      status,
      location,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { eventName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          ticketTypes: true,
          revenueShares: true,
          creator: {
            select: { address: true, role: true }
          },
          _count: {
            select: { tickets: true, favorites: true }
          }
        },
        orderBy: { [sortBy]: order },
        skip,
        take: parseInt(limit)
      }),
      prisma.event.count({ where })
    ]);

    // Calculate ticket status for each event
    const eventsWithStatus = events.map(event => {
      const totalTickets = event.ticketTypes.reduce((sum, type) => sum + type.totalSupply, 0);
      const soldTickets = event.ticketTypes.reduce((sum, type) => sum + type.sold, 0);
      
      let ticketStatus = 'available';
      if (soldTickets === totalTickets) ticketStatus = 'sold_out';
      else if (soldTickets / totalTickets > 0.9) ticketStatus = 'limited';

      return {
        ...event,
        ticketStatus,
        totalTicketsSold: soldTickets
      };
    });

    return successResponse(res, {
      events: eventsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching events:', error);
    return errorResponse(res, 'Failed to fetch events', 500);
  }
};

// Get event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: true,
        revenueShares: true,
        creator: {
          select: { address: true, role: true }
        },
        _count: {
          select: { tickets: true, favorites: true }
        }
      }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Calculate ticket status
    const totalTickets = event.ticketTypes.reduce((sum, type) => sum + type.totalSupply, 0);
    const soldTickets = event.ticketTypes.reduce((sum, type) => sum + type.sold, 0);
    
    let ticketStatus = 'available';
    if (soldTickets === totalTickets) ticketStatus = 'sold_out';
    else if (soldTickets / totalTickets > 0.9) ticketStatus = 'limited';

    return successResponse(res, {
      ...event,
      ticketStatus,
      totalTicketsSold: soldTickets
    });

  } catch (error) {
    logger.error('Error fetching event:', error);
    return errorResponse(res, 'Failed to fetch event', 500);
  }
};

// Add ticket type (EO function)
const addTicketType = async (req, res) => {
  try {
    const { eventId, typeName, description, price, totalSupply, saleStartTime, saleEndTime } = req.body;
    const eventCreator = req.user.address;

    // Verify event ownership
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (event.eventCreator !== eventCreator) {
      return errorResponse(res, 'Not authorized to modify this event', 403);
    }

    if (event.status !== 'APPROVED') {
      return errorResponse(res, 'Event must be approved before adding ticket types', 400);
    }

    // Create ticket type
    const ticketType = await prisma.ticketType.create({
      data: {
        typeId: 0, // Will be updated
        eventId: event.id,
        typeName,
        description,
        price: ethers.parseEther(price.toString()).toString(),
        totalSupply,
        saleStartTime: new Date(saleStartTime),
        saleEndTime: new Date(saleEndTime),
        active: true
      }
    });

    // Update event to active if not already
    if (!event.eventActive) {
      await prisma.event.update({
        where: { id: eventId },
        data: { eventActive: true }
      });
    }

    logger.info(`Ticket type added: ${ticketType.id} for event ${eventId}`);

    return successResponse(res, {
      ticketTypeId: ticketType.id,
      message: 'Ticket type added successfully'
    }, 201);

  } catch (error) {
    logger.error('Error adding ticket type:', error);
    return errorResponse(res, 'Failed to add ticket type', 500);
  }
};

// Purchase tickets
const purchaseTickets = async (req, res) => {
  try {
    const { eventId, typeId, quantity, buyerAddress } = req.body;

    // Validate event and ticket type
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTypes: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (event.status !== 'APPROVED') {
      return errorResponse(res, 'Event not approved', 400);
    }

    const ticketType = event.ticketTypes.find(t => t.id === typeId);
    if (!ticketType) {
      return errorResponse(res, 'Ticket type not found', 404);
    }

    if (!ticketType.active) {
      return errorResponse(res, 'Ticket type not active', 400);
    }

    const now = new Date();
    if (now < ticketType.saleStartTime || now > ticketType.saleEndTime) {
      return errorResponse(res, 'Ticket sale not active', 400);
    }

    if (ticketType.sold + quantity > ticketType.totalSupply) {
      return errorResponse(res, 'Not enough tickets available', 400);
    }

    // Check user purchase limit
    const userPurchases = await prisma.ticket.count({
      where: {
        eventId: event.id,
        currentOwner: buyerAddress
      }
    });

    if (userPurchases + quantity > 5) {
      return errorResponse(res, 'Maximum 5 tickets per user per event', 400);
    }

    // Mint tickets on blockchain
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const result = await blockchainService.mintTicket(
        buyerAddress,
        event.id,
        ticketType.id,
        ticketType.price,
        event.eventCreator
      );

      // Create ticket in database
      const ticket = await prisma.ticket.create({
        data: {
          ticketId: result.tokenId,
          eventId: event.id,
          typeId: ticketType.id,
          currentOwner: buyerAddress,
          isUsed: false,
          mintedAt: new Date(),
          isForResale: false,
          resaleCount: 0,
          txHash: result.txHash
        }
      });

      tickets.push(ticket);
    }

    // Update ticket type sold count
    await prisma.ticketType.update({
      where: { id: typeId },
      data: { sold: { increment: quantity } }
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        txHash: tickets[0].txHash,
        type: 'TICKET_PURCHASE',
        from: 'SYSTEM',
        to: buyerAddress,
        eventId: event.id,
        amount: (BigInt(ticketType.price) * BigInt(quantity)).toString(),
        status: 'CONFIRMED',
        timestamp: new Date()
      }
    });

    logger.info(`Tickets purchased: ${quantity} for event ${eventId} by ${buyerAddress}`);

    return successResponse(res, {
      tickets: tickets.map(t => ({
        ticketId: t.ticketId,
        tokenId: t.ticketId,
        eventId: t.eventId,
        typeId: t.typeId
      })),
      totalCost: (BigInt(ticketType.price) * BigInt(quantity)).toString(),
      message: 'Tickets purchased successfully'
    });

  } catch (error) {
    logger.error('Error purchasing tickets:', error);
    return errorResponse(res, 'Failed to purchase tickets', 500);
  }
};

// Get event statistics
const getEventStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: {
          include: {
            _count: { select: { tickets: true } }
          }
        },
        tickets: true,
        _count: {
          select: { favorites: true }
        }
      }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    const totalTickets = event.ticketTypes.reduce((sum, type) => sum + type.totalSupply, 0);
    const soldTickets = event.ticketTypes.reduce((sum, type) => sum + type.sold, 0);
    const totalRevenue = event.tickets.reduce((sum, ticket) => {
      const ticketType = event.ticketTypes.find(t => t.id === ticket.typeId);
      return sum + BigInt(ticketType?.price || 0);
    }, BigInt(0));

    const statistics = {
      totalTickets,
      soldTickets,
      availableTickets: totalTickets - soldTickets,
      totalRevenue: totalRevenue.toString(),
      favorites: event._count.favorites,
      ticketTypes: event.ticketTypes.map(type => ({
        typeId: type.id,
        typeName: type.typeName,
        totalSupply: type.totalSupply,
        sold: type.sold,
        available: type.totalSupply - type.sold,
        price: type.price
      }))
    };

    return successResponse(res, statistics);

  } catch (error) {
    logger.error('Error fetching event statistics:', error);
    return errorResponse(res, 'Failed to fetch event statistics', 500);
  }
};

// Toggle favorite
const toggleFavorite = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId: parseInt(eventId)
        }
      }
    });

    if (existingFavorite) {
      await prisma.favorite.delete({
        where: { id: existingFavorite.id }
      });
      return successResponse(res, { isFavorited: false, message: 'Removed from favorites' });
    } else {
      await prisma.favorite.create({
        data: {
          userId,
          eventId: parseInt(eventId)
        }
      });
      return successResponse(res, { isFavorited: true, message: 'Added to favorites' });
    }

  } catch (error) {
    logger.error('Error toggling favorite:', error);
    return errorResponse(res, 'Failed to toggle favorite', 500);
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  addTicketType,
  purchaseTickets,
  getEventStatistics,
  toggleFavorite
};
