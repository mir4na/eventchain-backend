const prisma = require('../config/database');
const blockchainService = require('./blockchainService');

class TicketService {
  async getUserTickets(userAddress, filters = {}) {
    const { status, eventId } = filters;

    const user = await prisma.user.findUnique({
      where: { walletAddress: userAddress.toLowerCase() }
    });

    if (!user) {
      return [];
    }

    const where = {
      ownerId: user.id
    };

    if (eventId) {
      where.eventId = eventId;
    }

    if (status === 'active') {
      where.isUsed = false;
      where.event = {
        date: { gt: new Date() }
      };
    } else if (status === 'used') {
      where.isUsed = true;
    } else if (status === 'past') {
      where.event = {
        date: { lt: new Date() }
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
        owner: true,
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
      where.eventId = eventId;
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
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const transactions = await prisma.transaction.findMany({
      where: { ticketId: ticket.id },
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

    const user = await prisma.user.findUnique({
      where: { walletAddress: userAddress.toLowerCase() }
    });

    if (!user) {
      return [];
    }

    const where = {
      userId: user.id
    };

    if (type) {
      where.type = type;
    }

    if (eventId) {
      where.eventId = eventId;
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
        name: tx.event.name
      } : null,
      ticket: tx.ticket ? {
        ticketId: tx.ticket.ticketId,
        typeName: tx.ticket.ticketType?.name
      } : null
    }));
  }

  async checkPurchaseEligibility(userAddress, eventId, quantity) {
    const user = await prisma.user.findUnique({
      where: { walletAddress: userAddress.toLowerCase() }
    });

    if (!user) {
      return {
        canPurchase: true,
        currentPurchases: 0,
        maxAllowed: 5,
        remaining: 5,
        requestedQuantity: quantity
      };
    }

    const currentPurchases = await prisma.ticket.count({
      where: {
        ownerId: user.id,
        eventId: eventId
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
    const ticketType = await prisma.ticketType.findFirst({
      where: {
        eventId: eventId,
        typeId: parseInt(typeId)
      }
    });

    if (!ticketType) {
      throw new Error('Ticket type not found');
    }

    const available = ticketType.stock - ticketType.sold;
    const now = new Date();
    const saleStarted = now >= ticketType.saleStartDate;
    const saleEnded = now > ticketType.saleEndDate;

    let status = 'available';
    if (!saleStarted) {
      status = 'not_started';
    } else if (saleEnded) {
      status = 'ended';
    } else if (available === 0) {
      status = 'sold_out';
    } else if (available / ticketType.stock < 0.1) {
      status = 'limited';
    }

    return {
      typeId: ticketType.typeId,
      name: ticketType.name,
      price: ticketType.price,
      totalSupply: ticketType.stock,
      sold: ticketType.sold,
      available,
      status,
      saleStartDate: ticketType.saleStartDate,
      saleEndDate: ticketType.saleEndDate,
      active: ticketType.active
    };
  }

  formatTicketResponse(ticket) {
    const canResell = ticket.resaleCount < 1 && !ticket.isUsed;
    const maxResalePrice = canResell && ticket.ticketType
      ? (BigInt(ticket.ticketType.price) * BigInt(120) / BigInt(100)).toString()
      : null;

    return {
      ticketId: ticket.ticketId,
      eventId: ticket.event?.eventId,
      typeId: ticket.ticketType?.typeId,
      currentOwner: ticket.owner?.walletAddress,
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
      qrCode: ticket.qrCode,
      event: ticket.event ? {
        eventId: ticket.event.eventId,
        name: ticket.event.name,
        date: ticket.event.date,
        location: ticket.event.location,
        posterUrl: ticket.event.posterUrl,
        creator: ticket.event.creator
      } : null,
      ticketType: ticket.ticketType ? {
        typeId: ticket.ticketType.typeId,
        name: ticket.ticketType.name,
        price: ticket.ticketType.price,
        description: ticket.ticketType.description
      } : null,
      transactions: ticket.transactions || []
    };
  }
}

module.exports = new TicketService();