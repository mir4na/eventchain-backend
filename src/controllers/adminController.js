const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Approve event
const approveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (event.status !== 'PENDING') {
      return errorResponse(res, 'Event already processed', 400);
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });

    logger.info(`Event approved: ${eventId}`);

    return successResponse(res, {
      message: 'Event approved successfully'
    });

  } catch (error) {
    logger.error('Error approving event:', error);
    return errorResponse(res, 'Failed to approve event', 500);
  }
};

// Reject event
const rejectEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (event.status !== 'PENDING') {
      return errorResponse(res, 'Event already processed', 400);
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'REJECTED'
      }
    });

    logger.info(`Event rejected: ${eventId}`);

    return successResponse(res, {
      message: 'Event rejected successfully'
    });

  } catch (error) {
    logger.error('Error rejecting event:', error);
    return errorResponse(res, 'Failed to reject event', 500);
  }
};

// Get pending events
const getPendingEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PENDING' },
      include: {
        creator: {
          select: { address: true, role: true }
        },
        revenueShares: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, { events });

  } catch (error) {
    logger.error('Error fetching pending events:', error);
    return errorResponse(res, 'Failed to fetch pending events', 500);
  }
};

// Get admin statistics
const getAdminStats = async (req, res) => {
  try {
    const [
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,
      totalTickets,
      totalRevenue,
      totalUsers
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { status: 'PENDING' } }),
      prisma.event.count({ where: { status: 'APPROVED' } }),
      prisma.event.count({ where: { status: 'REJECTED' } }),
      prisma.ticket.count(),
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE' },
        _sum: { amount: true }
      }),
      prisma.user.count()
    ]);

    const revenue = totalRevenue._sum.amount || '0';

    return successResponse(res, {
      events: {
        total: totalEvents,
        pending: pendingEvents,
        approved: approvedEvents,
        rejected: rejectedEvents
      },
      tickets: {
        total: totalTickets
      },
      revenue: {
        total: revenue
      },
      users: {
        total: totalUsers
      }
    });

  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    return errorResponse(res, 'Failed to fetch admin statistics', 500);
  }
};

// Add admin
const addAdmin = async (req, res) => {
  try {
    const { adminAddress } = req.body;

    const existingAdmin = await prisma.admin.findUnique({
      where: { address: adminAddress }
    });

    if (existingAdmin) {
      return errorResponse(res, 'Admin already exists', 400);
    }

    await prisma.admin.create({
      data: {
        address: adminAddress,
        addedBy: req.user.address,
        addedAt: new Date()
      }
    });

    logger.info(`Admin added: ${adminAddress} by ${req.user.address}`);

    return successResponse(res, {
      message: 'Admin added successfully'
    });

  } catch (error) {
    logger.error('Error adding admin:', error);
    return errorResponse(res, 'Failed to add admin', 500);
  }
};

// Remove admin
const removeAdmin = async (req, res) => {
  try {
    const { adminAddress } = req.params;

    const admin = await prisma.admin.findUnique({
      where: { address: adminAddress }
    });

    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    await prisma.admin.update({
      where: { address: adminAddress },
      data: { active: false }
    });

    logger.info(`Admin removed: ${adminAddress} by ${req.user.address}`);

    return successResponse(res, {
      message: 'Admin removed successfully'
    });

  } catch (error) {
    logger.error('Error removing admin:', error);
    return errorResponse(res, 'Failed to remove admin', 500);
  }
};

// Get all admins
const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      where: { active: true },
      orderBy: { addedAt: 'desc' }
    });

    return successResponse(res, { admins });

  } catch (error) {
    logger.error('Error fetching admins:', error);
    return errorResponse(res, 'Failed to fetch admins', 500);
  }
};

module.exports = {
  approveEvent,
  rejectEvent,
  getPendingEvents,
  getAdminStats,
  addAdmin,
  removeAdmin,
  getAdmins
};
