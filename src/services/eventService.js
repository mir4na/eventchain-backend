const prisma = require('../config/database');

class EventService {
  async getAllEvents(filters = {}) {
    const { status, location, search, sortBy = 'createdAt', order = 'desc' } = filters;

    const where = {};

    if (status) {
      if (status === 'active') {
        where.status = 'ACTIVE';
        where.date = { gte: new Date() };
      } else if (status === 'done') {
        where.date = { lt: new Date() };
      } else if (status === 'pending') {
        where.status = 'PENDING';
      }
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        creator: {
          select: {
            walletAddress: true,
            name: true
          }
        },
        ticketTypes: {
          where: { active: true }
        },
        _count: {
          select: { tickets: true, favorites: true }
        }
      },
      orderBy: { [sortBy]: order }
    });

    return events.map(event => this.formatEventResponse(event));
  }

  async getEventById(eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: {
          select: {
            walletAddress: true,
            name: true
          }
        },
        ticketTypes: {
          where: { active: true },
          orderBy: { createdAt: 'asc' }
        },
        proposals: {
          where: { status: 'APPROVED' }
        },
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
    const user = await prisma.user.findUnique({
      where: { walletAddress: creatorAddress.toLowerCase() }
    });

    if (!user) {
      return [];
    }

    const events = await prisma.event.findMany({
      where: { creatorId: user.id },
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

  async getEventStatistics(eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTypes: true,
        tickets: true,
        transactions: {
          where: { type: 'PURCHASE' }
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
      typeName: type.name,
      sold: type.sold,
      totalSupply: type.stock,
      revenue: (BigInt(type.price) * BigInt(type.sold)).toString()
    }));

    return {
      eventId: event.eventId,
      name: event.name,
      totalTicketsSold: event.tickets.length,
      totalRevenue: totalRevenue.toString(),
      ticketStats,
      activeListings: event.tickets.filter(t => t.isForResale).length,
      usedTickets: event.tickets.filter(t => t.isUsed).length
    };
  }

  async toggleFavorite(userId, eventId) {
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId
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
          eventId
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
            creator: {
              select: {
                walletAddress: true,
                name: true
              }
            },
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
    const eventDate = new Date(event.date);
    
    let ticketStatus = 'available';
    if (event.ticketTypes && event.ticketTypes.length > 0) {
      const availableTickets = event.ticketTypes.reduce((sum, type) => {
        return sum + (type.stock - type.sold);
      }, 0);

      const totalSupply = event.ticketTypes.reduce((sum, type) => {
        return sum + type.stock;
      }, 0);

      if (availableTickets === 0) {
        ticketStatus = 'sold_out';
      } else if (availableTickets / totalSupply < 0.1) {
        ticketStatus = 'limited';
      }
    }

    return {
      id: event.id,
      eventId: event.eventId,
      name: event.name,
      description: event.description,
      location: event.location,
      date: event.date,
      posterUrl: event.posterUrl,
      status: event.status,
      ticketStatus,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      creator: event.creator ? {
        walletAddress: event.creator.walletAddress,
        name: event.creator.name
      } : null,
      ticketTypes: event.ticketTypes || [],
      proposals: event.proposals || [],
      totalTicketsSold: event._count?.tickets || 0,
      totalFavorites: event._count?.favorites || 0,
      isPast: eventDate < now
    };
  }
}

module.exports = new EventService();