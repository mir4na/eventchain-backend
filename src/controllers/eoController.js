const prisma = require('../config/database');
const blockchainService = require('../services/blockchainService');
const { successResponse, errorResponse } = require('../utils/response');
const { generateTicketUseSignature, generateNonce, generateDeadline } = require('../middleware/signature');
const logger = require('../utils/logger');
const { ethers } = require('ethers');

class EOController {
  async createEvent(req, res) {
    try {
      const {
        name,
        description,
        location,
        date,
        posterUrl,
        creatorAddress,
        revenueBeneficiaries,
        taxWalletAddress,
        creatorId
      } = req.body;

      if (!name || !location || !date || !creatorAddress) {
        return errorResponse(res, 'Missing required fields', 400);
      }

      if (!posterUrl) {
        return errorResponse(res, 'Poster URL is required', 400);
      }

      if (!ethers.isAddress(creatorAddress)) {
        return errorResponse(res, 'Invalid creator address', 400);
      }

      if (revenueBeneficiaries && revenueBeneficiaries.length > 0) {
        const totalPercentage = revenueBeneficiaries.reduce((sum, b) => sum + b.percentage, 0);
        if (totalPercentage !== 10000) {
          return errorResponse(res, 'Revenue percentages must total 100% (10000 basis points)', 400);
        }
        for (const beneficiary of revenueBeneficiaries) {
          if (!ethers.isAddress(beneficiary.address)) {
            return errorResponse(res, `Invalid beneficiary address: ${beneficiary.address}`, 400);
          }
        }
      }

      const user = await prisma.user.findUnique({
        where: {
          id: creatorId,
          // walletAddress: creatorAddress.toLowerCase(),
        },
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const event = await prisma.event.create({
        data: {
          name,
          description,
          location,
          date: new Date(date),
          posterUrl,
          status: 'PENDING',
          creatorId: user.id
        }
      });

      const proposal = await prisma.proposal.create({
        data: {
          eventId: event.id,
          creatorId: user.id,
          revenueBeneficiaries: revenueBeneficiaries || [],
          taxWalletAddress: taxWalletAddress || creatorAddress.toLowerCase(),
          status: 'PENDING'
        }
      });

      logger.info(`Created event ${event.id} by ${creatorAddress}`);
      return successResponse(res, { event, proposal }, 'Event created successfully and pending admin approval');
    } catch (error) {
      logger.error('Create event error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getEOEvents(req, res) {
    try {
      const { address } = req.params;

      const user = await prisma.user.findUnique({
        where: { walletAddress: address.toLowerCase() }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const events = await prisma.event.findMany({
        where: { creatorId: user.id },
        include: {
          ticketTypes: true,
          proposals: true,
          _count: {
            select: { tickets: true, bookmarks: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return successResponse(res, events, 'EO events retrieved successfully');
    } catch (error) {
      logger.error('Get EO events error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async updateEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { description, location, posterUrl } = req.body;

      const existingEvent = await prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!existingEvent) {
        return errorResponse(res, 'Event not found', 404);
      }

      if (existingEvent.status !== 'PENDING') {
        return errorResponse(res, 'Cannot edit event after approval', 400);
      }

      const updateData = {};
      if (description !== undefined) updateData.description = description;
      if (location !== undefined) updateData.location = location;
      if (posterUrl !== undefined) updateData.posterUrl = posterUrl;
      updateData.updatedAt = new Date();

      const event = await prisma.event.update({
        where: { id: eventId },
        data: updateData
      });

      logger.info(`Updated event ${eventId}`);
      return successResponse(res, event, 'Event updated');
    } catch (error) {
      logger.error('Update event error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async deactivateEvent(req, res) {
    try {
      const { eventId } = req.params;

      const event = await prisma.event.update({
        where: { id: eventId },
        data: { status: 'ENDED' }
      });

      logger.info(`Deactivated event ${eventId}`);
      return successResponse(res, event, 'Event deactivated');
    } catch (error) {
      logger.error('Deactivate event error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async addTicketType(req, res) {
    try {
      const { eventId } = req.params;
      const { name, description, price, stock, saleStartDate, saleEndDate, benefits } = req.body;

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          ticketTypes: true
        }
      });

      if (!event) return errorResponse(res, 'Event not found', 404);
      if (event.status !== 'APPROVED') return errorResponse(res, 'Event must be approved first', 400);

      const ticketType = await prisma.ticketType.create({
        data: {
          eventId: event.id,
          name,
          description,
          price,
          stock: parseInt(stock),
          sold: 0,
          saleStartDate: new Date(saleStartDate),
          saleEndDate: new Date(saleEndDate),
          benefits: benefits || {}
        }
      });

      await blockchainService.setTicketTypePrice(event.eventId, ticketType.typeId, price);

      const allTicketTypes = await prisma.ticketType.findMany({
        where: { eventId: event.id }
      });

      if (allTicketTypes.length > 0) {
        await prisma.event.update({ 
          where: { id: eventId }, 
          data: { status: 'ACTIVE' } 
        });
      }

      logger.info(`Added ticket type for event ${eventId}`);
      return successResponse(res, ticketType, 'Ticket type added successfully');
    } catch (error) {
      logger.error('Add ticket type error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async updateTicketType(req, res) {
    try {
      const { typeId } = req.params;
      const { price, stock, saleStartDate, saleEndDate, benefits } = req.body;

      const existingType = await prisma.ticketType.findUnique({
        where: { id: typeId },
        include: { event: true }
      });

      if (!existingType) return errorResponse(res, 'Ticket type not found', 404);

      const updateData = {};
      if (price !== undefined) updateData.price = price;
      if (stock !== undefined) updateData.stock = parseInt(stock);
      if (saleStartDate !== undefined) updateData.saleStartDate = new Date(saleStartDate);
      if (saleEndDate !== undefined) updateData.saleEndDate = new Date(saleEndDate);
      if (benefits !== undefined) updateData.benefits = benefits;

      const ticketType = await prisma.ticketType.update({
        where: { id: typeId },
        data: updateData
      });

      if (price !== undefined) {
        await blockchainService.setTicketTypePrice(existingType.event.eventId, existingType.typeId, price);
      }

      logger.info(`Updated ticket type ${typeId}`);
      return successResponse(res, ticketType, 'Ticket type updated');
    } catch (error) {
      logger.error('Update ticket type error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getTicketTypes(req, res) {
    try {
      const { eventId } = req.params;

      const ticketTypes = await prisma.ticketType.findMany({
        where: { eventId },
        orderBy: { createdAt: 'asc' }
      });

      return successResponse(res, ticketTypes, 'Ticket types retrieved');
    } catch (error) {
      logger.error('Get ticket types error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getEventRevenue(req, res) {
    try {
      const { eventId } = req.params;

      const transactions = await prisma.transaction.findMany({
        where: { eventId, type: 'PURCHASE' }
      });

      const totalRevenue = transactions.reduce((sum, tx) => sum + BigInt(tx.amount), BigInt(0));
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { proposals: { where: { status: 'APPROVED' } } }
      });

      let revenueShares = [];
      if (event.proposals.length > 0) revenueShares = event.proposals[0].revenueBeneficiaries;

      const TAX_PERCENTAGE = 1000;
      const BASIS_POINTS = 10000;
      const taxAmount = (totalRevenue * BigInt(TAX_PERCENTAGE)) / BigInt(BASIS_POINTS);
      const netAmount = totalRevenue - taxAmount;

      const detailedShares = revenueShares.map(share => {
        const shareAmount = (netAmount * BigInt(share.percentage)) / BigInt(BASIS_POINTS);
        return {
          address: share.address,
          name: share.name || 'Unknown',
          percentage: share.percentage,
          amount: shareAmount.toString()
        };
      });

      return successResponse(res, {
        totalRevenue: totalRevenue.toString(),
        taxAmount: taxAmount.toString(),
        netAmount: netAmount.toString(),
        transactions: transactions.length,
        revenueShares: detailedShares
      }, 'Revenue retrieved');
    } catch (error) {
      logger.error('Get revenue error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getEventAnalytics(req, res) {
    try {
      const { eventId } = req.params;

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          ticketTypes: true,
          tickets: true,
          transactions: { where: { type: 'PURCHASE' } },
          _count: { select: { bookmarks: true } }
        }
      });

      if (!event) return errorResponse(res, 'Event not found', 404);

      const totalTicketsSold = event.tickets.length;
      const totalRevenue = event.transactions.reduce((sum, tx) => sum + BigInt(tx.amount), BigInt(0));
      const ticketStats = event.ticketTypes.map(type => ({
        typeName: type.name,
        sold: type.sold,
        totalSupply: type.stock,
        percentage: type.stock > 0 ? (type.sold / type.stock * 100).toFixed(2) : 0
      }));
      const salesByDay = await this.getSalesByDay(eventId);

      return successResponse(res, {
        totalTicketsSold,
        totalRevenue: totalRevenue.toString(),
        ticketStats,
        salesByDay,
        activeListings: event.tickets.filter(t => t.isForResale).length,
        usedTickets: event.tickets.filter(t => t.isUsed).length,
        bookmarkCount: event._count.bookmarks
      }, 'Analytics retrieved');
    } catch (error) {
      logger.error('Get analytics error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getDashboardStats(req, res) {
    try {
      const { address } = req.params;

      const user = await prisma.user.findUnique({
        where: { walletAddress: address.toLowerCase() }
      });

      if (!user) return errorResponse(res, 'User not found', 404);

      const events = await prisma.event.findMany({
        where: { creatorId: user.id },
        include: { tickets: true, transactions: { where: { type: 'PURCHASE' } } }
      });

      const totalEvents = events.length;
      const activeEvents = events.filter(e => e.status === 'ACTIVE').length;
      const totalTicketsSold = events.reduce((sum, e) => sum + e.tickets.length, 0);
      const totalRevenue = events.reduce((sum, e) => sum + e.transactions.reduce((txSum, tx) => txSum + BigInt(tx.amount), BigInt(0)), BigInt(0));

      return successResponse(res, {
        totalEvents,
        activeEvents,
        totalTicketsSold,
        totalRevenue: totalRevenue.toString()
      }, 'Dashboard stats retrieved');
    } catch (error) {
      logger.error('Get dashboard stats error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async verifyTicket(req, res) {
    try {
      const { ticketId } = req.params;

      const ticket = await prisma.ticket.findUnique({
        where: { ticketId: parseInt(ticketId) },
        include: { event: { include: { creator: true } }, ticketType: true, owner: true }
      });

      if (!ticket) return errorResponse(res, 'Ticket not found', 404);

      const nonce = generateNonce();
      const deadline = generateDeadline(5);
      const signature = await generateTicketUseSignature(ticket.ticketId, ticket.event.eventId, req.body.scannerAddress || ticket.owner.walletAddress, nonce, deadline);

      const qrData = {
        ticketId: ticket.ticketId,
        eventId: ticket.event.eventId,
        eventName: ticket.event.name,
        ticketType: ticket.ticketType.name,
        currentOwner: ticket.owner.walletAddress,
        isUsed: ticket.isUsed,
        isValid: !ticket.isUsed && new Date(ticket.event.date) >= new Date(),
        nonce,
        deadline,
        signature
      };

      return successResponse(res, qrData, 'Ticket verified');
    } catch (error) {
      logger.error('Verify ticket error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async useTicket(req, res) {
    try {
      const { ticketId } = req.params;
      const { eventCreatorAddress, scannerAddress } = req.body;

      const ticket = await prisma.ticket.findFirst({
        where: { ticketId: parseInt(ticketId) },
        include: { event: { include: { creator: true } } }
      });

      if (!ticket) return errorResponse(res, 'Ticket not found', 404);
      if (ticket.event.creator.walletAddress !== eventCreatorAddress.toLowerCase()) return errorResponse(res, 'Unauthorized', 403);
      if (ticket.isUsed) return errorResponse(res, 'Ticket already used', 400);

      const nonce = generateNonce();
      const deadline = generateDeadline(5);
      const signature = await generateTicketUseSignature(ticket.ticketId, ticket.event.eventId, scannerAddress || ticket.owner.walletAddress, nonce, deadline);

      logger.info(`Generated signature for ticket ${ticketId}`);
      return successResponse(res, { ticketId: ticket.ticketId, eventId: ticket.event.eventId, nonce, deadline, signature, message: 'Use this signature on contract' }, 'Signature generated');
    } catch (error) {
      logger.error('Use ticket error', error);
      return errorResponse(res, error.message, 500);
    }
  }

  async getSalesByDay(eventId) {
    const transactions = await prisma.transaction.findMany({
      where: { eventId, type: 'PURCHASE' },
      orderBy: { timestamp: 'asc' }
    });

    const salesByDay = {};
    transactions.forEach(tx => {
      const date = tx.timestamp.toISOString().split('T')[0];
      if (!salesByDay[date]) salesByDay[date] = 0;
      salesByDay[date]++;
    });

    return Object.entries(salesByDay).map(([date, count]) => ({ date, sales: count }));
  }
}

module.exports = new EOController();