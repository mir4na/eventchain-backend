const { ethers } = require('ethers');
const contractService = require('../services/blockchainService');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');

class AdminController {
    async addAdmin(req, res) {
        try {
            const { adminAddress } = req.body;

            if (!ethers.isAddress(adminAddress)) {
                return errorResponse(res, 400, 'Invalid Ethereum address');
            }

            const contract = await contractService.getContract();
            const tx = await contract.addAdmin(adminAddress);
            await tx.wait();

            logger.info(`New admin added: ${adminAddress}`);
            return successResponse(res, 'Admin added successfully', { 
                adminAddress,
                txHash: tx.hash 
            });
        } catch (error) {
            logger.error('Error adding admin:', error);
            return errorResponse(res, 500, 'Failed to add admin');
        }
    }

    async removeAdmin(req, res) {
        try {
            const { adminAddress } = req.body;

            if (!ethers.isAddress(adminAddress)) {
                return errorResponse(res, 400, 'Invalid Ethereum address');
            }

            const contract = await contractService.getContract();
            const tx = await contract.removeAdmin(adminAddress);
            await tx.wait();

            logger.info(`Admin removed: ${adminAddress}`);
            return successResponse(res, 'Admin removed successfully', {
                adminAddress,
                txHash: tx.hash
            });
        } catch (error) {
            logger.error('Error removing admin:', error);
            return errorResponse(res, 500, 'Failed to remove admin');
        }
    }

    async approveEvent(req, res) {
        try {
            const { eventId } = req.params;

            const contract = await contractService.getContract();
            const tx = await contract.approveEvent(eventId);
            await tx.wait();

            logger.info(`Event approved: ${eventId}`);
            return successResponse(res, 'Event approved successfully', {
                eventId,
                txHash: tx.hash
            });
        } catch (error) {
            logger.error('Error approving event:', error);
            return errorResponse(res, 500, 'Failed to approve event');
        }
    }

    async rejectEvent(req, res) {
        try {
            const { eventId } = req.params;

            const contract = await contractService.getContract();
            const tx = await contract.rejectEvent(eventId);
            await tx.wait();

            logger.info(`Event rejected: ${eventId}`);
            return successResponse(res, 'Event rejected successfully', {
                eventId,
                txHash: tx.hash
            });
        } catch (error) {
            logger.error('Error rejecting event:', error);
            return errorResponse(res, 500, 'Failed to reject event');
        }
    }

    async getAdminStats(req, res) {
        try {
            const contract = await contractService.getContract();
            
            const totalEvents = await contract._currentEventId();
            
            const totalTickets = await contract._currentTicketId();

            const recentEvents = [];
            for (let i = totalEvents; i > Math.max(0, totalEvents - 10); i--) {
                const event = await contract.getEventDetails(i);
                recentEvents.push(event);
            }

            return successResponse(res, 'Admin stats retrieved successfully', {
                totalEvents: totalEvents.toString(),
                totalTickets: totalTickets.toString(),
                recentEvents
            });
        } catch (error) {
            logger.error('Error getting admin stats:', error);
            return errorResponse(res, 500, 'Failed to get admin stats');
        }
    }

    async getPendingEvents(req, res) {
        try {
            const contract = await contractService.getContract();
            const totalEvents = await contract._currentEventId();
            
            const pendingEvents = [];
            for (let i = 1; i <= totalEvents; i++) {
                const event = await contract.getEventDetails(i);
                if (event.status === 0) { // Pending status
                    pendingEvents.push({
                        eventId: i,
                        ...event
                    });
                }
            }

            return successResponse(res, 'Pending events retrieved successfully', {
                pendingEvents
            });
        } catch (error) {
            logger.error('Error getting pending events:', error);
            return errorResponse(res, 500, 'Failed to get pending events');
        }
    }

    async verifyAdmin(req, res) {
        try {
            const { address } = req.params;

            if (!ethers.isAddress(address)) {
                return errorResponse(res, 400, 'Invalid Ethereum address');
            }

            const contract = await contractService.getContract();
            const isAdmin = await contract.isAdmin(address);

            return successResponse(res, 'Admin verification completed', {
                address,
                isAdmin
            });
        } catch (error) {
            logger.error('Error verifying admin:', error);
            return errorResponse(res, 500, 'Failed to verify admin');
        }
    }
}

module.exports = new AdminController();