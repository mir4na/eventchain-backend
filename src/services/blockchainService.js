const { ethers } = require('ethers');
const logger = require('../utils/logger');

const EventChainABI = [
  "function setPlatformWallet(address wallet) external",
  "function setBackendSigner(address signer) external",
  "function configureEvent(uint256 eventId, address eventCreator, address taxWallet) external returns (bool)",
  "function setTicketTypePrice(uint256 eventId, uint256 typeId, uint256 price) external",
  "function finalizeEvent(uint256 eventId) external",
  "function buyTickets(uint256 eventId, uint256 typeId, uint256 quantity, address[] beneficiaries, uint256[] percentages) external payable returns (uint256[])",
  "function listTicketForResale(uint256 ticketId, uint256 resalePrice, uint256 resaleDeadline) external",
  "function buyResaleTicket(uint256 ticketId) external payable",
  "function cancelResaleListing(uint256 ticketId) external",
  "function useTicket(uint256 ticketId, uint256 eventId, uint256 nonce, uint256 deadline, bytes signature) external",
  "function withdraw() external",
  "function setTokenURI(uint256 ticketId, string uri) external",
  "function getTicketDetails(uint256 ticketId) external view returns (tuple(uint256 ticketId, uint256 eventId, uint256 typeId, address currentOwner, uint256 originalPrice, bool isUsed, uint256 mintedAt, uint256 usedAt, bool isForResale, uint256 resalePrice, uint256 resaleDeadline, uint8 resaleCount))",
  "function getResaleTickets() external view returns (uint256[])",
  "function getUserTickets(address user) external view returns (uint256[])",
  "function getUserEventTicketCount(address user, uint256 eventId) external view returns (uint256)",
  "function getPendingWithdrawal(address user) external view returns (uint256)",
  "function getTicketTypePrice(uint256 eventId, uint256 typeId) external view returns (uint256)",
  "function canResell(uint256 ticketId) external view returns (bool)",
  "function getMaxResalePrice(uint256 ticketId) external view returns (uint256)",
  "function getEventCreator(uint256 eventId) external view returns (address)",
  "function isEventFinalized(uint256 eventId) external view returns (bool)",
  "function platformWallet() external view returns (address)",
  "function backendSigner() external view returns (address)",
  "event PlatformWalletUpdated(address indexed newWallet)",
  "event BackendSignerUpdated(address indexed newSigner)",
  "event EventFinalized(uint256 indexed eventId)",
  "event TokenURIUpdated(uint256 indexed ticketId, string uri)",
  "event TicketTypePriceSet(uint256 indexed eventId, uint256 indexed typeId, uint256 price)",
  "event Withdrawn(address indexed user, uint256 amount)",
  "event RevenueConfigured(uint256 indexed eventId, address indexed creator, address indexed taxWallet)",
  "event TicketMinted(uint256 indexed ticketId, uint256 indexed eventId, uint256 indexed typeId, address buyer, uint256 price)",
  "event TicketsPurchased(uint256 indexed eventId, uint256 indexed typeId, address indexed buyer, uint256 quantity, uint256 totalCost, uint256 taxAmount, uint256[] ticketIds)",
  "event TicketListedForResale(uint256 indexed ticketId, uint256 indexed eventId, address indexed seller, uint256 resalePrice, uint256 deadline)",
  "event TicketResold(uint256 indexed ticketId, uint256 indexed eventId, address indexed from, address to, uint256 price, uint256 taxAmount)",
  "event ResaleListingCancelled(uint256 indexed ticketId, address indexed seller)",
  "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId, address indexed user, uint256 timestamp)",
  "event RevenueDistributed(uint256 indexed eventId, uint256 totalAmount, uint256 taxAmount, uint256 netAmount, uint256 timestamp)"
];

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      EventChainABI,
      this.wallet
    );
    this.readOnlyContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      EventChainABI,
      this.provider
    );
  }

  async verifyBackendSigner(expectedAddress) {
    try {
      const contractSigner = await this.readOnlyContract.backendSigner();
      const match = contractSigner.toLowerCase() === expectedAddress.toLowerCase();
      
      if (!match) {
        logger.error(`Backend signer mismatch! Contract: ${contractSigner}, Expected: ${expectedAddress}`);
        return false;
      }
      
      logger.info(`✅ Backend signer verified: ${contractSigner}`);
      return true;
    } catch (error) {
      logger.error('Error verifying backend signer:', error);
      return false;
    }
  }

  async getBackendSigner() {
    try {
      return await this.readOnlyContract.backendSigner();
    } catch (error) {
      logger.error('Error getting backend signer:', error);
      throw error;
    }
  }

  async getPlatformWallet() {
    try {
      return await this.readOnlyContract.platformWallet();
    } catch (error) {
      logger.error('Error getting platform wallet:', error);
      throw error;
    }
  }

  async configureEvent(eventId, eventCreator, taxWallet) {
    try {
      const tx = await this.contract.configureEvent(
        eventId,
        eventCreator,
        taxWallet
      );

      const receipt = await tx.wait();
      logger.info(`Event configured: ${eventId}. TxHash: ${receipt.hash}`);
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error('Error configuring event:', error);
      throw error;
    }
  }

  async setTicketTypePrice(eventId, typeId, price) {
    try {
      const priceInWei = ethers.parseEther(price.toString());
      
      const tx = await this.contract.setTicketTypePrice(
        eventId,
        typeId,
        priceInWei
      );

      const receipt = await tx.wait();
      logger.info(`Ticket type price set: Event ${eventId}, Type ${typeId}. TxHash: ${receipt.hash}`);
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error('Error setting ticket type price:', error);
      throw error;
    }
  }

  async finalizeEvent(eventId) {
    try {
      const tx = await this.contract.finalizeEvent(eventId);

      const receipt = await tx.wait();
      logger.info(`Event finalized: ${eventId}. TxHash: ${receipt.hash}`);
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error('Error finalizing event:', error);
      throw error;
    }
  }

  async getTicketDetails(ticketId) {
    try {
      const ticket = await this.readOnlyContract.getTicketDetails(ticketId);
      return {
        ticketId: ticket.ticketId.toString(),
        eventId: ticket.eventId.toString(),
        typeId: ticket.typeId.toString(),
        currentOwner: ticket.currentOwner,
        originalPrice: ticket.originalPrice.toString(),
        isUsed: ticket.isUsed,
        mintedAt: new Date(Number(ticket.mintedAt) * 1000),
        usedAt: ticket.usedAt > 0 ? new Date(Number(ticket.usedAt) * 1000) : null,
        isForResale: ticket.isForResale,
        resalePrice: ticket.resalePrice.toString(),
        resaleDeadline: ticket.resaleDeadline > 0 ? new Date(Number(ticket.resaleDeadline) * 1000) : null,
        resaleCount: ticket.resaleCount,
      };
    } catch (error) {
      logger.error('Error getting ticket details:', error);
      throw error;
    }
  }

  async getUserTickets(walletAddress) {
    try {
      const ticketIds = await this.readOnlyContract.getUserTickets(walletAddress);
      return ticketIds.map(id => id.toString());
    } catch (error) {
      logger.error('Error getting user tickets:', error);
      throw error;
    }
  }

  async getUserEventTicketCount(walletAddress, eventId) {
    try {
      const count = await this.readOnlyContract.getUserEventTicketCount(walletAddress, eventId);
      return Number(count);
    } catch (error) {
      logger.error('Error getting user event ticket count:', error);
      throw error;
    }
  }

  async getResaleTickets() {
    try {
      const ticketIds = await this.readOnlyContract.getResaleTickets();
      return ticketIds.map(id => id.toString());
    } catch (error) {
      logger.error('Error getting resale tickets:', error);
      throw error;
    }
  }

  async canResell(ticketId) {
    try {
      return await this.readOnlyContract.canResell(ticketId);
    } catch (error) {
      logger.error('Error checking resell eligibility:', error);
      throw error;
    }
  }

  async getMaxResalePrice(ticketId) {
    try {
      const maxPrice = await this.readOnlyContract.getMaxResalePrice(ticketId);
      return maxPrice.toString();
    } catch (error) {
      logger.error('Error getting max resale price:', error);
      throw error;
    }
  }

  async getEventCreator(eventId) {
    try {
      return await this.readOnlyContract.getEventCreator(eventId);
    } catch (error) {
      logger.error('Error getting event creator:', error);
      throw error;
    }
  }

  async isEventFinalized(eventId) {
    try {
      return await this.readOnlyContract.isEventFinalized(eventId);
    } catch (error) {
      logger.error('Error checking event finalized:', error);
      throw error;
    }
  }

  async getPendingWithdrawal(address) {
    try {
      const amount = await this.readOnlyContract.getPendingWithdrawal(address);
      return amount.toString();
    } catch (error) {
      logger.error('Error getting pending withdrawal:', error);
      throw error;
    }
  }

  async getTicketTypePrice(eventId, typeId) {
    try {
      const price = await this.readOnlyContract.getTicketTypePrice(eventId, typeId);
      return ethers.formatEther(price);
    } catch (error) {
      logger.error('Error getting ticket type price:', error);
      throw error;
    }
  }
}

module.exports = new BlockchainService();