const { ethers } = require('ethers');
const { CONTRACT_ADDRESS, RPC_URL } = require('../config/blockchain');

const EVENT_TICKET_NFT_ABI = [
  "function mintTicket(address to, uint256 eventId, uint256 typeId, uint256 originalPrice) external returns (uint256)",
  "function listTicketForResale(uint256 ticketId, uint256 resalePrice, uint256 resaleDeadline) external",
  "function buyResaleTicket(uint256 ticketId) external payable",
  "function cancelResaleListing(uint256 ticketId) external",
  "function useTicket(uint256 ticketId) external",
  "function getTicketDetails(uint256 ticketId) external view returns (tuple(uint256 ticketId, uint256 eventId, uint256 typeId, address currentOwner, bool isUsed, uint256 mintedAt, uint256 usedAt, bool isForResale, uint256 resalePrice, uint256 resaleDeadline, uint8 resaleCount))",
  "function getUserTickets(address user) external view returns (uint256[])",
  "function getResaleTickets() external view returns (uint256[])",
  "function canResell(uint256 ticketId) external view returns (bool)",
  "function getMaxResalePrice(uint256 ticketId) external view returns (uint256)",
  "function owner() external view returns (address)",
  "event TicketMinted(uint256 indexed ticketId, uint256 indexed eventId, uint256 indexed typeId, address buyer)",
  "event TicketTransferred(uint256 indexed ticketId, address from, address to)",
  "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId, address user)",
  "event TicketListedForResale(uint256 indexed ticketId, uint256 resalePrice, uint256 deadline)",
  "event TicketResold(uint256 indexed ticketId, address from, address to, uint256 price)",
  "event ResaleListingCancelled(uint256 indexed ticketId)"
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
  }

  async connect() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, EVENT_TICKET_NFT_ABI, this.provider);
    }
  }

  async connectWithSigner(privateKey) {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, EVENT_TICKET_NFT_ABI, this.signer);
  }

  // Mint ticket (called by backend when user purchases)
  async mintTicket(to, eventId, typeId, originalPrice) {
    try {
      await this.connectWithSigner(process.env.PRIVATE_KEY);
      
      const tx = await this.contract.mintTicket(
        to,
        eventId,
        typeId,
        ethers.parseEther(originalPrice.toString())
      );
      
      const receipt = await tx.wait();
      return {
        ticketId: receipt.logs[0].args.ticketId.toString(),
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      throw new Error(`Failed to mint ticket: ${error.message}`);
    }
  }

  // Get ticket information
  async getTicketInfo(tokenId) {
    try {
      await this.connect();
      const ticket = await this.contract.getTicketDetails(tokenId);
      return {
        ticketId: ticket.ticketId.toString(),
        eventId: ticket.eventId.toString(),
        typeId: ticket.typeId.toString(),
        currentOwner: ticket.currentOwner,
        isUsed: ticket.isUsed,
        mintedAt: new Date(Number(ticket.mintedAt) * 1000),
        usedAt: ticket.usedAt ? new Date(Number(ticket.usedAt) * 1000) : null,
        isForResale: ticket.isForResale,
        resalePrice: ticket.resalePrice ? ethers.formatEther(ticket.resalePrice) : null,
        resaleDeadline: ticket.resaleDeadline ? new Date(Number(ticket.resaleDeadline) * 1000) : null,
        resaleCount: Number(ticket.resaleCount)
      };
    } catch (error) {
      throw new Error(`Failed to get ticket info: ${error.message}`);
    }
  }

  // List ticket for resale
  async listForResale(tokenId, resalePrice, resaleDeadline) {
    try {
      await this.connectWithSigner(process.env.PRIVATE_KEY);
      
      const tx = await this.contract.listTicketForResale(
        tokenId,
        ethers.parseEther(resalePrice.toString()),
        Math.floor(resaleDeadline.getTime() / 1000)
      );
      
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      throw new Error(`Failed to list for resale: ${error.message}`);
    }
  }

  // Buy resale ticket
  async buyResaleTicket(tokenId, price) {
    try {
      await this.connectWithSigner(process.env.PRIVATE_KEY);
      
      const tx = await this.contract.buyResaleTicket(tokenId, {
        value: ethers.parseEther(price.toString())
      });
      
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      throw new Error(`Failed to buy resale ticket: ${error.message}`);
    }
  }

  // Cancel resale listing
  async cancelResaleListing(tokenId) {
    try {
      await this.connectWithSigner(process.env.PRIVATE_KEY);
      
      const tx = await this.contract.cancelResaleListing(tokenId);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      throw new Error(`Failed to cancel resale listing: ${error.message}`);
    }
  }

  // Use ticket (for event organizers)
  async useTicket(tokenId) {
    try {
      await this.connectWithSigner(process.env.PRIVATE_KEY);
      
      const tx = await this.contract.useTicket(tokenId);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      throw new Error(`Failed to use ticket: ${error.message}`);
    }
  }

  // Check if ticket is used
  async isTicketUsed(tokenId) {
    try {
      const details = await this.getTicketInfo(tokenId);
      return details.isUsed;
    } catch (error) {
      throw new Error(`Failed to check ticket usage: ${error.message}`);
    }
  }

  // Check if ticket can be resold
  async canResell(tokenId) {
    try {
      await this.connect();
      return await this.contract.canResell(tokenId);
    } catch (error) {
      throw new Error(`Failed to check resell eligibility: ${error.message}`);
    }
  }

  // Get maximum resale price
  async getMaxResalePrice(tokenId) {
    try {
      await this.connect();
      const price = await this.contract.getMaxResalePrice(tokenId);
      return ethers.formatEther(price);
    } catch (error) {
      throw new Error(`Failed to get max resale price: ${error.message}`);
    }
  }

  // Get ticket owner
  async getTicketOwner(tokenId) {
    try {
      const details = await this.getTicketInfo(tokenId);
      return details.currentOwner;
    } catch (error) {
      throw new Error(`Failed to get ticket owner: ${error.message}`);
    }
  }

  // Get token URI
  async getTokenURI(tokenId) {
    try {
      await this.connect();
      return await this.contract.tokenURI(tokenId);
    } catch (error) {
      throw new Error(`Failed to get token URI: ${error.message}`);
    }
  }

  // Wait for transaction
  async waitForTransaction(txHash) {
    try {
      await this.connect();
      return await this.provider.waitForTransaction(txHash);
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  // Get user tickets
  async getUserTickets(address) {
    try {
      await this.connect();
      const ticketIds = await this.contract.getUserTickets(address);
      return ticketIds.map(id => id.toString());
    } catch (error) {
      throw new Error(`Failed to get user tickets: ${error.message}`);
    }
  }

  // Get resale tickets
  async getResaleTickets() {
    try {
      await this.connect();
      const ticketIds = await this.contract.getResaleTickets();
      return ticketIds.map(id => id.toString());
    } catch (error) {
      throw new Error(`Failed to get resale tickets: ${error.message}`);
    }
  }
}

module.exports = new BlockchainService();