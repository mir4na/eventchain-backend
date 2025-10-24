const prisma = require('../config/database');
const blockchainService = require('../services/blockchainService');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');

class AdminController {
  async getPendingProposals(req, res) {
    try {
      const proposals = await prisma.proposal.findMany({
        where: { status: 'PENDING' },
        include: {
          event: {
            include: {
              ticketTypes: true,
              creator: {
                select: {
                  id: true,
                  walletAddress: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return successResponse(res, proposals, 'Pending proposals retrieved');
    } catch (error) {
      logger.error('Error fetching proposals:', error);
      return errorResponse(res, 'Failed to fetch proposals', 500);
    }
  }

  async getEventsWithProposals(req, res) {
    try {
      const events = await prisma.event.findMany({
        where: { status: 'PENDING' },
        include: {
          creator: {
            select: {
              id: true,
              walletAddress: true,
              name: true,
              email: true,
            },
          },
          proposals: {
            where: { status: 'PENDING' }
          },
          ticketTypes: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(res, events, 'Events with pending proposals retrieved');
    } catch (error) {
      logger.error('Error fetching events with proposals:', error);
      return errorResponse(res, 'Failed to fetch events with proposals', 500);
    }
  }

  async approveProposal(req, res) {
    const { proposalId } = req.params;
    const { taxWalletAddress, adminComment } = req.body;

    try {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          event: {
            include: {
              creator: true,
            },
          },
        },
      });

      if (!proposal) {
        return errorResponse(res, 'Proposal not found', 404);
      }

      if (proposal.status !== 'PENDING') {
        return errorResponse(res, 'Proposal already reviewed', 400);
      }

      const finalTaxWallet = taxWalletAddress || proposal.taxWalletAddress;

      const blockchainResult = await blockchainService.configureEvent(
        proposal.event.eventId,
        proposal.event.creator.walletAddress,
        finalTaxWallet
      );

      await prisma.$transaction([
        prisma.proposal.update({
          where: { id: proposalId },
          data: {
            status: 'APPROVED',
            adminComment: adminComment || 'Approved',
            reviewedAt: new Date(),
            taxWalletAddress: finalTaxWallet,
          },
        }),
        
        prisma.event.update({
          where: { id: proposal.eventId },
          data: {
            status: 'APPROVED',
          },
        }),
      ]);

      logger.info(`Proposal approved: ${proposalId}`);
      return successResponse(res, {
        proposalId,
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber,
      }, 'Proposal approved successfully');
    } catch (error) {
      logger.error('Error approving proposal:', error);
      return errorResponse(res, 'Failed to approve proposal', 500);
    }
  }

  async rejectProposal(req, res) {
    const { proposalId } = req.params;
    const { adminComment } = req.body;

    try {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
      });

      if (!proposal) {
        return errorResponse(res, 'Proposal not found', 404);
      }

      if (proposal.status !== 'PENDING') {
        return errorResponse(res, 'Proposal already reviewed', 400);
      }

      await prisma.$transaction([
        prisma.proposal.update({
          where: { id: proposalId },
          data: {
            status: 'REJECTED',
            adminComment: adminComment || 'Rejected',
            reviewedAt: new Date(),
          },
        }),
        prisma.event.update({
          where: { id: proposal.eventId },
          data: {
            status: 'CANCELLED',
          },
        }),
      ]);

      logger.info(`Proposal rejected: ${proposalId}`);
      return successResponse(res, null, 'Proposal rejected');
    } catch (error) {
      logger.error('Error rejecting proposal:', error);
      return errorResponse(res, 'Failed to reject proposal', 500);
    }
  }

  async getTransactionStats(req, res) {
    try {
      const [
        totalEvents,
        activeEvents,
        totalTicketsSold,
        totalRevenue,
        recentTransactions
      ] = await Promise.all([
        prisma.event.count(),
        prisma.event.count({ where: { status: 'ACTIVE' } }),
        prisma.ticket.count(),
        prisma.transaction.aggregate({
          where: { type: 'PURCHASE' },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: {
                walletAddress: true,
                name: true,
              },
            },
          },
        }),
      ]);

      return successResponse(res, {
        totalEvents,
        activeEvents,
        totalTicketsSold,
        totalRevenue: totalRevenue._sum.amount || '0',
        recentTransactions,
      }, 'Statistics retrieved');
    } catch (error) {
      logger.error('Error fetching stats:', error);
      return errorResponse(res, 'Failed to fetch statistics', 500);
    }
  }

  async getAdminStats(req, res) {
    try {
      const [
        totalEvents,
        activeEvents,
        totalTicketsSold,
        totalRevenue,
        recentTransactions
      ] = await Promise.all([
        prisma.event.count(),
        prisma.event.count({ where: { status: 'ACTIVE' } }),
        prisma.ticket.count(),
        prisma.transaction.aggregate({
          where: { type: 'PURCHASE' },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: {
                walletAddress: true,
                name: true,
              },
            },
          },
        }),
      ]);

      return successResponse(res, {
        totalEvents,
        activeEvents,
        totalTicketsSold,
        totalRevenue: totalRevenue._sum.amount || '0',
        recentTransactions,
      }, 'Admin statistics retrieved');
    } catch (error) {
      logger.error('Error fetching admin stats:', error);
      return errorResponse(res, 'Failed to fetch admin statistics', 500);
    }
  }

  async getEventOrganizers(req, res) {
    try {
      const eos = await prisma.user.findMany({
        where: { role: 'EO' },
        select: {
          id: true,
          walletAddress: true,
          name: true,
          email: true,
          createdAt: true,
          _count: {
            select: {
              events: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(res, eos, 'Event organizers retrieved');
    } catch (error) {
      logger.error('Error fetching EOs:', error);
      return errorResponse(res, 'Failed to fetch event organizers', 500);
    }
  }

  async addAdmin(req, res) {
    try {
      const { address } = req.body;

      if (!address) {
        return errorResponse(res, 'Address is required', 400);
      }

      const admin = await prisma.admin.create({
        data: {
          address: address.toLowerCase(),
          active: true
        }
      });

      logger.info(`Admin added: ${address}`);
      return successResponse(res, admin, 'Admin added successfully');
    } catch (error) {
      logger.error('Error adding admin:', error);
      return errorResponse(res, 'Failed to add admin', 500);
    }
  }

  async removeAdmin(req, res) {
    try {
      const { address } = req.body;

      if (!address) {
        return errorResponse(res, 'Address is required', 400);
      }

      await prisma.admin.update({
        where: { address: address.toLowerCase() },
        data: { active: false }
      });

      logger.info(`Admin removed: ${address}`);
      return successResponse(res, null, 'Admin removed successfully');
    } catch (error) {
      logger.error('Error removing admin:', error);
      return errorResponse(res, 'Failed to remove admin', 500);
    }
  }

  async verifyAdmin(req, res) {
    try {
      const { address } = req.params;

      const admin = await prisma.admin.findUnique({
        where: { 
          address: address.toLowerCase(),
          active: true
        }
      });

      return successResponse(res, { 
        isAdmin: !!admin 
      }, 'Admin verification completed');
    } catch (error) {
      logger.error('Error verifying admin:', error);
      return errorResponse(res, 'Admin verification failed', 500);
    }
  }
}

module.exports = new AdminController();