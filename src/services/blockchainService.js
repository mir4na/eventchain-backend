const { contract } = require('../config/blockchain');
const { ethers } = require('ethers');

class BlockchainService {
  async getEventDetails(eventId) {
    try {
      const event = await contract.getEventDetails(eventId);
      return {
        eventId: Number(event.eventId),
        eventCreator: event.eventCreator,
        eventName: event.eventName,
        eventURI: event.eventURI,
        documentURI: event.documentURI,
        eventDate: Number(event.eventDate),
        eventActive: event.eventActive,
        status: Number(event.status),
        createdAt: Number(event.createdAt),
        approvedAt: Number(event.approvedAt)
      };
    } catch (error) {
      throw new Error(`Failed to get event details: ${error.message}`);
    }
  }

  async getTicketDetails(ticketId) {
    try {
      const ticket = await contract.getTicketDetails(ticketId);
      return {
        ticketId: Number(ticket.ticketId),
        eventId: Number(ticket.eventId),
        typeId: Number(ticket.typeId),
        currentOwner: ticket.currentOwner,
        isUsed: ticket.isUsed,
        mintedAt: Number(ticket.mintedAt),
        usedAt: Number(ticket.usedAt),
        isForResale: ticket.isForResale,
        resalePrice: ticket.resalePrice.toString(),
        resaleDeadline: Number(ticket.resaleDeadline),
        resaleCount: Number(ticket.resaleCount)
      };
    } catch (error) {
      throw new Error(`Failed to get ticket details: ${error.message}`);
    }
  }

  async getTicketType(eventId, typeId) {
    try {
      const ticketType = await contract.getTicketType(eventId, typeId);
      return {
        typeId: Number(ticketType.typeId),
        typeName: ticketType.typeName,
        price: ticketType.price.toString(),
        totalSupply: Number(ticketType.totalSupply),
        sold: Number(ticketType.sold),
        saleStartTime: Number(ticketType.saleStartTime),
        saleEndTime: Number(ticketType.saleEndTime),
        active: ticketType.active
      };
    } catch (error) {
      throw new Error(`Failed to get ticket type: ${error.message}`);
    }
  }

  async getEventTicketTypes(eventId) {
    try {
      const typeIds = await contract.getEventTicketTypes(eventId);
      return typeIds.map(id => Number(id));
    } catch (error) {
      throw new Error(`Failed to get event ticket types: ${error.message}`);
    }
  }

  async getRevenueShares(eventId) {
    try {
      const shares = await contract.getRevenueShares(eventId);
      return shares.map(share => ({
        beneficiary: share.beneficiary,
        percentage: Number(share.percentage)
      }));
    } catch (error) {
      throw new Error(`Failed to get revenue shares: ${error.message}`);
    }
  }

  async getEOEvents(address) {
    try {
      const eventIds = await contract.getEOEvents(address);
      return eventIds.map(id => Number(id));
    } catch (error) {
      throw new Error(`Failed to get EO events: ${error.message}`);
    }
  }

  async getUserTickets(address) {
    try {
      const ticketIds = await contract.getUserTickets(address);
      return ticketIds.map(id => Number(id));
    } catch (error) {
      throw new Error(`Failed to get user tickets: ${error.message}`);
    }
  }

  async getResaleTickets() {
    try {
      const ticketIds = await contract.getResaleTickets();
      return ticketIds.map(id => Number(id));
    } catch (error) {
      throw new Error(`Failed to get resale tickets: ${error.message}`);
    }
  }

  async getUserPurchaseCount(address, eventId) {
    try {
      const count = await contract.getUserPurchaseCount(address, eventId);
      return Number(count);
    } catch (error) {
      throw new Error(`Failed to get purchase count: ${error.message}`);
    }
  }

  async canResell(ticketId) {
    try {
      return await contract.canResell(ticketId);
    } catch (error) {
      throw new Error(`Failed to check resell eligibility: ${error.message}`);
    }
  }

  async getMaxResalePrice(ticketId) {
    try {
      const price = await contract.getMaxResalePrice(ticketId);
      return price.toString();
    } catch (error) {
      throw new Error(`Failed to get max resale price: ${error.message}`);
    }
  }

  async isAdmin(address) {
    try {
      return await contract.isAdmin(address);
    } catch (error) {
      throw new Error(`Failed to check admin status: ${error.message}`);
    }
  }

  async waitForTransaction(txHash) {
    try {
      const receipt = await contract.runner.provider.waitForTransaction(txHash);
      return receipt;
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}

module.exports = new BlockchainService();