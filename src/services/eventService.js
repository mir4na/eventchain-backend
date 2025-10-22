const prisma = require('../config/database');
const blockchainService = require('./blockchainService');

class EventService {
  async getAllEvents(filters = {}) {
    const { status, location, search, sortBy = 'createdAt', order = 'desc' } = filters;

    const where = {};

    if (status) {
      if (status === 'active') {
        where.eventActive = true;
        where.status = 'APPROVED';
      } else if (status === 'done') {
        where.eventDate = { lt: new Date() };
      }
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { eventName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        creator: true,
        ticketTypes: {
          where: { active: true }
        },
        _count: {
          select: { tickets: true }
        }
      },
      orderBy: { [sortBy]: order }
    });

    return events.map(event => this.formatEventResponse(event));
  }

  async getEventById(eventId) {
    const event = await prisma.event.findUnique({
      where: { eventId: parseInt(eventId) },
      include: {
        creator: true,
        ticketTypes: {
          where: { active: true },
          orderBy: { createdAt: 'asc' }
        },
        revenueShares: true,
        _count: {
          select: { tickets: true, favorites: true }
        }
      }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return this.formatEventResponse(event);
  }

  async getEventsByCreator(creatorAddress) {
    const events = await prisma.event.findMany({
      where: { eventCreator: creatorAddress },
      include: {
        ticketTypes: {
          where: { active: true }
        },
        _count: {
          select: { tickets: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return events.map(event => this.formatEventResponse(event));
  }

  async getPendingEvents() {
    const events = await prisma.event.findMany({
      where: { status: 'PENDING' },
      include: {
        creator: true,
        revenueShares: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return events;
  }

  async getEventStatistics(eventId) {
    const event = await prisma.event.findUnique({
      where: { eventId: parseInt(eventId) },
      include: {
        ticketTypes: true,
        tickets: true,
        transactions: {
          where: { type: 'TICKET_PURCHASE' }
        }
      }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const totalRevenue = event.transactions.reduce((sum, tx) => {
      return sum + BigInt(tx.amount);
    }, BigInt(0));

    const ticketStats = event.ticketTypes.map(type => ({
      typeName: type.typeName,
      sold: type.sold,
      totalSupply: type.totalSupply,
      revenue: BigInt(type.price) * BigInt(type.sold)
    }));

    return {
      eventId: event.eventId,
      eventName: event.eventName,
      totalTicketsSold: event.tickets.length,
      totalRevenue: totalRevenue.toString(),
      ticketStats,
      activeListings: event.tickets.filter(t => t.isForResale).length,
      usedTickets: event.tickets.filter(t => t.isUsed).length
    };
  }

  async toggleFavorite(userId, eventId) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId: parseInt(eventId)
        }
      }
    });

    if (existing) {
      await prisma.favorite.delete({
        where: { id: existing.id }
      });
      return { favorited: false };
    } else {
      await prisma.favorite.create({
        data: {
          userId,
          eventId: parseInt(eventId)
        }
      });
      return { favorited: true };
    }
  }

  async getUserFavorites(userId) {
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            ticketTypes: {
              where: { active: true }
            },
            _count: {
              select: { tickets: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return favorites.map(fav => this.formatEventResponse(fav.event));
  }

  formatEventResponse(event) {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    
    let ticketStatus = 'available';
    if (event.ticketTypes && event.ticketTypes.length > 0) {
      const availableTickets = event.ticketTypes.reduce((sum, type) => {
        return sum + (type.totalSupply - type.sold);
      }, 0);

      const totalSupply = event.ticketTypes.reduce((sum, type) => {
        return sum + type.totalSupply;
      }, 0);

      if (availableTickets === 0) {
        ticketStatus = 'sold_out';
      } else if (availableTickets / totalSupply < 0.1) {
        ticketStatus = 'limited';
      }
    }

    return {
      eventId: event.eventId,
      eventName: event.eventName,
      eventURI: event.eventURI,
      documentURI: event.documentURI,
      description: event.description,
      location: event.location,
      eventDate: event.eventDate,
      eventActive: event.eventActive,
      status: event.status,
      ticketStatus,
      createdAt: event.createdAt,
      approvedAt: event.approvedAt,
      creator: event.creator ? {
        address: event.creator.address,
        role: event.creator.role
      } : null,
      ticketTypes: event.ticketTypes || [],
      revenueShares: event.revenueShares || [],
      totalTicketsSold: event._count?.tickets || 0,
      totalFavorites: event._count?.favorites || 0,
      isPast: eventDate < now
    };
  }
}

module.exports = new EventService();