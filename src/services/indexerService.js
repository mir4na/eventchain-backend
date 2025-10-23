const { ethers } = require('ethers');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const EventChainABI = [
  "event PlatformWalletUpdated(address indexed newWallet)",
  "event RevenueConfigured(uint256 indexed eventId, address indexed creator, address indexed taxWallet)",
  "event TicketMinted(uint256 indexed ticketId, uint256 indexed eventId, uint256 indexed typeId, address buyer, uint256 price)",
  "event TicketsPurchased(uint256 indexed eventId, uint256 indexed typeId, address indexed buyer, uint256 quantity, uint256 totalCost, uint256 taxAmount, uint256[] ticketIds)",
  "event TicketListedForResale(uint256 indexed ticketId, uint256 indexed eventId, address indexed seller, uint256 resalePrice, uint256 deadline)",
  "event TicketResold(uint256 indexed ticketId, uint256 indexed eventId, address indexed from, address to, uint256 price, uint256 taxAmount)",
  "event ResaleListingCancelled(uint256 indexed ticketId, address indexed seller)",
  "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId, address indexed user, uint256 timestamp)",
  "event RevenueDistributed(uint256 indexed eventId, uint256 totalAmount, uint256 taxAmount, uint256 netAmount, uint256 timestamp)"
];

class IndexerService {
  constructor() {
    this.isRunning = false;
    this.lastProcessedBlock = parseInt(process.env.START_BLOCK) || 0;
    this.BATCH_SIZE = 1000;
    this.RETRY_DELAY = 2000;
    this.MAX_RETRIES = 3;
    this.REQUEST_DELAY = 500;
    
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      EventChainABI,
      this.provider
    );
  }

  async start() {
    if (this.isRunning) {
      logger.info('Indexer already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting EventChain Indexer...');

    await this.loadLastProcessedBlock();
    await this.indexPastEvents();
    this.startRealTimeIndexing();
  }

  async loadLastProcessedBlock() {
    try {
      const lastBlock = await prisma.transaction.findFirst({
        orderBy: { blockNumber: 'desc' },
        select: { blockNumber: true }
      });

      if (lastBlock && lastBlock.blockNumber) {
        this.lastProcessedBlock = lastBlock.blockNumber;
      }

      logger.info(`Starting from block: ${this.lastProcessedBlock}`);
    } catch (error) {
      logger.error('Error loading last processed block:', error);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryWithBackoff(fn, retries = this.MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        const backoffDelay = this.RETRY_DELAY * Math.pow(2, i);
        logger.warn(`Retry ${i + 1}/${retries} after ${backoffDelay}ms`);
        await this.delay(backoffDelay);
      }
    }
  }

  async indexPastEvents() {
    try {
      const currentBlock = await this.retryWithBackoff(() => this.provider.getBlockNumber());
      logger.info(`Indexing from block ${this.lastProcessedBlock} to ${currentBlock}`);

      const events = [
        'RevenueConfigured',
        'TicketMinted',
        'TicketsPurchased',
        'TicketListedForResale',
        'TicketResold',
        'ResaleListingCancelled',
        'TicketUsed',
        'RevenueDistributed'
      ];

      for (const eventName of events) {
        await this.indexEventInBatches(eventName, this.lastProcessedBlock, currentBlock);
        await this.delay(this.REQUEST_DELAY);
      }

      this.lastProcessedBlock = currentBlock;
      logger.info('✅ Past events indexed successfully');
    } catch (error) {
      logger.error('Error indexing past events:', error);
    }
  }

  async indexEventInBatches(eventName, fromBlock, toBlock) {
    logger.info(`Indexing ${eventName} from block ${fromBlock} to ${toBlock}`);
    
    let currentFrom = fromBlock;
    
    while (currentFrom < toBlock) {
      const currentTo = Math.min(currentFrom + this.BATCH_SIZE, toBlock);
      
      try {
        await this.retryWithBackoff(async () => {
          const filter = this.contract.filters[eventName]();
          const logs = await this.contract.queryFilter(filter, currentFrom, currentTo);
          
          for (const log of logs) {
            await this.processEvent(eventName, log);
          }
        });
        
        logger.info(`Indexed ${eventName}: blocks ${currentFrom}-${currentTo}`);
        currentFrom = currentTo + 1;
        
        await this.delay(this.REQUEST_DELAY);
      } catch (error) {
        logger.error(`Error indexing ${eventName} batch ${currentFrom}-${currentTo}:`, error);
        await this.delay(this.RETRY_DELAY * 2);
      }
    }
  }

  startRealTimeIndexing() {
    const events = [
      'RevenueConfigured',
      'TicketMinted',
      'TicketsPurchased',
      'TicketListedForResale',
      'TicketResold',
      'ResaleListingCancelled',
      'TicketUsed',
      'RevenueDistributed'
    ];

    events.forEach(eventName => {
      this.contract.on(eventName, async (...args) => {
        const event = args[args.length - 1];
        try {
          await this.retryWithBackoff(() => this.processEvent(eventName, event));
        } catch (error) {
          logger.error(`Error processing real-time ${eventName}:`, error);
        }
      });
    });

    logger.info('✅ Real-time indexing started');
  }

  async processEvent(eventName, log) {
    try {
      const block = await this.retryWithBackoff(() => log.getBlock());
      
      switch (eventName) {
        case 'RevenueConfigured':
          await this.handleRevenueConfigured(log, block);
          break;
        case 'TicketMinted':
          await this.handleTicketMinted(log, block);
          break;
        case 'TicketsPurchased':
          await this.handleTicketsPurchased(log, block);
          break;
        case 'TicketListedForResale':
          await this.handleTicketListedForResale(log, block);
          break;
        case 'TicketResold':
          await this.handleTicketResold(log, block);
          break;
        case 'ResaleListingCancelled':
          await this.handleResaleListingCancelled(log, block);
          break;
        case 'TicketUsed':
          await this.handleTicketUsed(log, block);
          break;
        case 'RevenueDistributed':
          await this.handleRevenueDistributed(log, block);
          break;
      }

      logger.info(`Processed ${eventName} - Block: ${block.number}`);
    } catch (error) {
      logger.error(`Error processing ${eventName}:`, error);
    }
  }

  async handleRevenueConfigured(log, block) {
    const [eventId, creator, taxWallet] = log.args;
    
    logger.info(`Revenue configured for event ${eventId}`);
  }

  async handleTicketMinted(log, block) {
    const [ticketId, eventId, typeId, buyer, price] = log.args;

    await prisma.user.upsert({
      where: { walletAddress: buyer },
      create: { walletAddress: buyer, role: 'USER' },
      update: {}
    });

    await prisma.ticket.create({
      data: {
        ticketId: Number(ticketId),
        eventId: String(eventId),
        typeId: String(typeId),
        ownerId: buyer,
        txHash: log.transactionHash,
        blockNumber: block.number,
        originalPrice: price.toString(),
        mintedAt: new Date(block.timestamp * 1000),
        qrCode: `ticket-${ticketId}-${eventId}`
      }
    });
  }

  async handleTicketsPurchased(log, block) {
    const [eventId, typeId, buyer, quantity, totalCost, taxAmount, ticketIds] = log.args;

    const event = await prisma.event.findFirst({
      where: { eventId: Number(eventId) }
    });

    if (!event) {
      logger.warn(`Event ${eventId} not found in database`);
      return;
    }

    await prisma.ticketType.updateMany({
      where: {
        eventId: event.id,
        typeId: Number(typeId)
      },
      data: {
        sold: { increment: Number(quantity) }
      }
    });

    const user = await prisma.user.findUnique({
      where: { walletAddress: buyer }
    });

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        userId: user.id,
        type: 'PURCHASE',
        from: buyer,
        to: process.env.CONTRACT_ADDRESS,
        amount: totalCost.toString(),
        eventId: event.id,
        ticketIds: ticketIds.map(id => Number(id)),
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleTicketListedForResale(log, block) {
    const [ticketId, eventId, seller, resalePrice, deadline] = log.args;

    await prisma.ticket.updateMany({
      where: { ticketId: Number(ticketId) },
      data: {
        isForResale: true,
        resalePrice: resalePrice.toString(),
        resaleDeadline: new Date(Number(deadline) * 1000)
      }
    });
  }

  async handleTicketResold(log, block) {
    const [ticketId, eventId, from, to, price, taxAmount] = log.args;

    await prisma.user.upsert({
      where: { walletAddress: to },
      create: { walletAddress: to, role: 'USER' },
      update: {}
    });

    const newOwner = await prisma.user.findUnique({
      where: { walletAddress: to }
    });

    await prisma.ticket.updateMany({
      where: { ticketId: Number(ticketId) },
      data: {
        ownerId: newOwner.id,
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null,
        resaleCount: { increment: 1 }
      }
    });

    const fromUser = await prisma.user.findUnique({
      where: { walletAddress: from }
    });

    const ticket = await prisma.ticket.findFirst({
      where: { ticketId: Number(ticketId) }
    });

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        userId: newOwner.id,
        type: 'RESALE_BUY',
        from: from,
        to: to,
        amount: price.toString(),
        eventId: ticket.eventId,
        ticketIds: [Number(ticketId)],
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleResaleListingCancelled(log, block) {
    const [ticketId, seller] = log.args;

    await prisma.ticket.updateMany({
      where: { ticketId: Number(ticketId) },
      data: {
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null
      }
    });
  }

  async handleTicketUsed(log, block) {
    const [ticketId, eventId, user, timestamp] = log.args;

    await prisma.ticket.updateMany({
      where: { ticketId: Number(ticketId) },
      data: {
        isUsed: true,
        usedAt: new Date(Number(timestamp) * 1000)
      }
    });

    const ticket = await prisma.ticket.findFirst({
      where: { ticketId: Number(ticketId) },
      include: { owner: true }
    });

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        userId: ticket.owner.id,
        type: 'USE',
        from: user,
        to: process.env.CONTRACT_ADDRESS,
        amount: '0',
        eventId: ticket.eventId,
        ticketIds: [Number(ticketId)],
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleRevenueDistributed(log, block) {
    const [eventId, totalAmount, taxAmount, netAmount, timestamp] = log.args;
    
    logger.info(`Revenue distributed for event ${eventId}: ${totalAmount}`);
  }

  stop() {
    this.isRunning = false;
    this.contract.removeAllListeners();
    logger.info('Indexer stopped');
  }
}

const indexer = new IndexerService();

if (require.main === module) {
  indexer.start().catch(console.error);
}

module.exports = indexer;