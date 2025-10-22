const prisma = require('../config/database');
const blockchainService = require('./blockchainService');

class TicketService {
  async getUserTickets(userAddress, filters = {}) {
    const { status, eventId } = filters;

    const where = {
      currentOwner: userAddress
    };

    if (eventId) {
      where.eventId = parseInt(eventId);
    }

    if (status === 'active') {
      where.isUsed = false;
      where.event = {
        eventDate: { gt: new Date() }
      };
    } else if (status === 'used') {
      where.isUsed = true;
    } else if (status === 'past') {
      where.event = {
        eventDate: { lt: new Date() }
      };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        event: {
          include: {
            creator: true
          }
        },
        ticketType: true
      },
      orderBy: { mintedAt: 'desc' }
    });

    return tickets.map(ticket => this.formatTicketResponse(ticket));
  }

  async getTicketById(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) },
      include: {
        event: {
          include: {
            creator: true
          }
        },
        ticketType: true,
        transactions: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return this.formatTicketResponse(ticket);
  }

  async getResaleTickets(filters = {}) {
    const { eventId, minPrice, maxPrice } = filters;

    const where = {
      isForResale: true,
      resaleDeadline: { gt: new Date() }
    };

    if (eventId) {
      where.eventId = parseInt(eventId);
    }

    if (minPrice) {
      where.resalePrice = { gte: minPrice };
    }

    if (maxPrice) {
      where.resalePrice = { lte: maxPrice };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        event: {
          include: {
            creator: true
          }
        },
        ticketType: true,
        owner: true
      },
      orderBy: { resalePrice: 'asc' }
    });

    return tickets.map(ticket => this.formatTicketResponse(ticket));
  }

  async getTicketTransactionHistory(ticketId) {
    const transactions = await prisma.transaction.findMany({
      where: { ticketId: parseInt(ticketId) },
      orderBy: { timestamp: 'asc' }
    });

    return transactions.map(tx => ({
      txHash: tx.txHash,
      type: tx.type,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      timestamp: tx.timestamp,
      blockNumber: tx.blockNumber
    }));
  }

  async getUserTransactionHistory(userAddress, filters = {}) {
    const { type, eventId } = filters;

    const where = {
      OR: [
        { from: userAddress },
        { to: userAddress }
      ]
    };

    if (type) {
      where.type = type;
    }

    if (eventId) {
      where.eventId = parseInt(eventId);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        event: true,
        ticket: {
          include: {
            ticketType: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return transactions.map(tx => ({
      txHash: tx.txHash,
      type: tx.type,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      timestamp: tx.timestamp,
      blockNumber: tx.blockNumber,
      event: tx.event ? {
        eventId: tx.event.eventId,
        eventName: tx.event.eventName
      } : null,
      ticket: tx.ticket ? {
        ticketId: tx.ticket.ticketId,
        typeName: tx.ticket.ticketType?.typeName
      } : null
    }));
  }

  async checkPurchaseEligibility(userAddress, eventId, quantity) {
    const currentPurchases = await prisma.ticket.count({
      where: {
        currentOwner: userAddress,
        eventId: parseInt(eventId)
      }
    });

    const maxAllowed = 5;
    const remaining = maxAllowed - currentPurchases;

    return {
      canPurchase: remaining >= quantity,
      currentPurchases,
      maxAllowed,
      remaining,
      requestedQuantity: quantity
    };
  }

  async getTicketTypeAvailability(eventId, typeId) {
    const ticketType = await prisma.ticketType.findUnique({
      where: {
        eventId_typeId: {
          eventId: parseInt(eventId),
          typeId: parseInt(typeId)
        }
      }
    });

    if (!ticketType) {
      throw new Error('Ticket type not found');
    }

    const available = ticketType.totalSupply - ticketType.sold;
    const now = new Date();
    const saleStarted = now >= ticketType.saleStartTime;
    const saleEnded = now > ticketType.saleEndTime;

    let status = 'available';
    if (!saleStarted) {
      status = 'not_started';
    } else if (saleEnded) {
      status = 'ended';
    } else if (available === 0) {
      status = 'sold_out';
    } else if (available / ticketType.totalSupply < 0.1) {
      status = 'limited';
    }

    return {
      typeId: ticketType.typeId,
      typeName: ticketType.typeName,
      price: ticketType.price,
      totalSupply: ticketType.totalSupply,
      sold: ticketType.sold,
      available,
      status,
      saleStartTime: ticketType.saleStartTime,
      saleEndTime: ticketType.saleEndTime,
      active: ticketType.active
    };
  }

  formatTicketResponse(ticket) {
    const canResell = ticket.resaleCount < 1 && !ticket.isUsed;
    const maxResalePrice = canResell 
      ? (BigInt(ticket.ticketType.price) * BigInt(120) / BigInt(100)).toString()
      : null;

    return {
      ticketId: ticket.ticketId,
      eventId: ticket.eventId,
      typeId: ticket.typeId,
      currentOwner: ticket.currentOwner,
      isUsed: ticket.isUsed,
      mintedAt: ticket.mintedAt,
      usedAt: ticket.usedAt,
      isForResale: ticket.isForResale,
      resalePrice: ticket.resalePrice,
      resaleDeadline: ticket.resaleDeadline,
      resaleCount: ticket.resaleCount,
      canResell,
      maxResalePrice,
      txHash: ticket.txHash,
      event: ticket.event ? {
        eventId: ticket.event.eventId,
        eventName: ticket.event.eventName,
        eventDate: ticket.event.eventDate,
        location: ticket.event.location,
        eventURI: ticket.event.eventURI,
        creator: ticket.event.creator
      } : null,
      ticketType: ticket.ticketType ? {
        typeId: ticket.ticketType.typeId,
        typeName: ticket.ticketType.typeName,
        price: ticket.ticketType.price,
        description: ticket.ticketType.description
      } : null,
      transactions: ticket.transactions || []
    };
  }
}

module.exports = new TicketService();