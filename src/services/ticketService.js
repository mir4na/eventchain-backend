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

  async purchaseTickets(userAddress, eventId, typeId, quantity) {
    // Check eligibility
    const eligibility = await this.checkPurchaseEligibility(userAddress, eventId, quantity);
    if (!eligibility.canPurchase) {
      throw new Error('Purchase limit exceeded');
    }

    // Get ticket type details
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

    if (ticketType.sold + quantity > ticketType.totalSupply) {
      throw new Error('Not enough tickets available');
    }

    const now = new Date();
    if (now < ticketType.saleStartTime) {
      throw new Error('Sale has not started yet');
    }

    if (now > ticketType.saleEndTime) {
      throw new Error('Sale has ended');
    }

    // Mint tickets on blockchain
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const result = await blockchainService.mintTicket(
        userAddress,
        parseInt(eventId),
        parseInt(typeId),
        ticketType.price
      );

      // Save to database
      const ticket = await prisma.ticket.create({
        data: {
          ticketId: parseInt(result.ticketId),
          eventId: parseInt(eventId),
          typeId: parseInt(typeId),
          currentOwner: userAddress,
          mintedAt: new Date(),
          txHash: result.txHash
        }
      });

      tickets.push(ticket);

      // Record transaction
      await prisma.transaction.create({
        data: {
          txHash: result.txHash,
          type: 'TICKET_PURCHASE',
          from: '0x0000000000000000000000000000000000000000', // System
          to: userAddress,
          eventId: parseInt(eventId),
          ticketId: parseInt(result.ticketId),
          amount: ticketType.price,
          status: 'CONFIRMED',
          blockNumber: result.blockNumber
        }
      });
    }

    // Update sold count
    await prisma.ticketType.update({
      where: {
        eventId_typeId: {
          eventId: parseInt(eventId),
          typeId: parseInt(typeId)
        }
      },
      data: {
        sold: ticketType.sold + quantity
      }
    });

    return tickets.map(ticket => this.formatTicketResponse(ticket));
  }

  async listTicketForResale(ticketId, resalePrice, resaleDeadline, userAddress) {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) },
      include: { ticketType: true }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.currentOwner !== userAddress) {
      throw new Error('Not ticket owner');
    }

    if (ticket.isUsed) {
      throw new Error('Ticket already used');
    }

    if (ticket.isForResale) {
      throw new Error('Ticket already listed for resale');
    }

    if (ticket.resaleCount >= 1) {
      throw new Error('Ticket cannot be resold');
    }

    const maxPrice = (BigInt(ticket.ticketType.price) * BigInt(120) / BigInt(100)).toString();
    if (BigInt(resalePrice) > BigInt(maxPrice)) {
      throw new Error('Resale price exceeds maximum allowed');
    }

    // List on blockchain
    const result = await blockchainService.listForResale(
      ticketId,
      resalePrice,
      new Date(resaleDeadline)
    );

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        isForResale: true,
        resalePrice: resalePrice,
        resaleDeadline: new Date(resaleDeadline)
      }
    });

    return {
      ticketId: parseInt(ticketId),
      resalePrice,
      resaleDeadline: new Date(resaleDeadline),
      txHash: result.txHash
    };
  }

  async buyResaleTicket(ticketId, buyerAddress) {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) },
      include: { ticketType: true }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (!ticket.isForResale) {
      throw new Error('Ticket not for resale');
    }

    if (new Date() > ticket.resaleDeadline) {
      throw new Error('Resale deadline passed');
    }

    // Buy on blockchain
    const result = await blockchainService.buyResaleTicket(ticketId, ticket.resalePrice);

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        currentOwner: buyerAddress,
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null,
        resaleCount: ticket.resaleCount + 1
      }
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        txHash: result.txHash,
        type: 'TICKET_RESALE',
        from: ticket.currentOwner,
        to: buyerAddress,
        eventId: ticket.eventId,
        ticketId: parseInt(ticketId),
        amount: ticket.resalePrice,
        status: 'CONFIRMED',
        blockNumber: result.blockNumber
      }
    });

    return {
      ticketId: parseInt(ticketId),
      newOwner: buyerAddress,
      txHash: result.txHash
    };
  }

  async cancelResaleListing(ticketId, userAddress) {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.currentOwner !== userAddress) {
      throw new Error('Not ticket owner');
    }

    if (!ticket.isForResale) {
      throw new Error('Ticket not listed for resale');
    }

    // Cancel on blockchain
    const result = await blockchainService.cancelResaleListing(ticketId);

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null
      }
    });

    return {
      ticketId: parseInt(ticketId),
      txHash: result.txHash
    };
  }

  async useTicket(ticketId, eventId) {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(ticketId) }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.eventId !== parseInt(eventId)) {
      throw new Error('Ticket does not belong to this event');
    }

    if (ticket.isUsed) {
      throw new Error('Ticket already used');
    }

    // Use on blockchain
    const result = await blockchainService.useTicket(ticketId);

    // Update database
    await prisma.ticket.update({
      where: { ticketId: parseInt(ticketId) },
      data: {
        isUsed: true,
        usedAt: new Date()
      }
    });

    return {
      ticketId: parseInt(ticketId),
      isUsed: true,
      usedAt: new Date(),
      txHash: result.txHash
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