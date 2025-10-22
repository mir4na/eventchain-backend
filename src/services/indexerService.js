const { contract, provider } = require('../config/blockchain');
const prisma = require('../config/database');
const logger = require('../utils/logger');

class IndexerService {
  constructor() {
    this.isRunning = false;
    this.lastProcessedBlock = parseInt(process.env.START_BLOCK) || 0;
    this.BATCH_SIZE = 1000;
    this.RETRY_DELAY = 2000;
    this.MAX_RETRIES = 3;
    this.REQUEST_DELAY = 500;
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
      const currentBlock = await this.retryWithBackoff(() => provider.getBlockNumber());
      logger.info(`Indexing from block ${this.lastProcessedBlock} to ${currentBlock}`);

      const events = [
        'EventCreated',
        'EventApproved',
        'EventRejected',
        'TicketTypeAdded',
        'TicketTypeUpdated',
        'TicketMinted',
        'TicketsPurchased',
        'TicketListedForResale',
        'TicketResold',
        'TicketUsed'
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
          const filter = contract.filters[eventName]();
          const logs = await contract.queryFilter(filter, currentFrom, currentTo);
          
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
      'EventCreated',
      'EventApproved',
      'EventRejected',
      'TicketTypeAdded',
      'TicketTypeUpdated',
      'TicketMinted',
      'TicketsPurchased',
      'TicketListedForResale',
      'TicketResold',
      'TicketUsed'
    ];

    events.forEach(eventName => {
      contract.on(eventName, async (...args) => {
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
        case 'EventCreated':
          await this.handleEventCreated(log, block);
          break;
        case 'EventApproved':
          await this.handleEventApproved(log, block);
          break;
        case 'EventRejected':
          await this.handleEventRejected(log, block);
          break;
        case 'TicketTypeAdded':
          await this.handleTicketTypeAdded(log, block);
          break;
        case 'TicketTypeUpdated':
          await this.handleTicketTypeUpdated(log, block);
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
        case 'TicketUsed':
          await this.handleTicketUsed(log, block);
          break;
      }

      logger.info(`Processed ${eventName} - Block: ${block.number}`);
    } catch (error) {
      logger.error(`Error processing ${eventName}:`, error);
    }
  }

  async handleEventCreated(log, block) {
    const [eventId, creator, eventName] = log.args;
    
    await prisma.user.upsert({
      where: { address: creator },
      create: { address: creator, role: 'EO' },
      update: {}
    });

    const eventDetails = await this.retryWithBackoff(() => 
      contract.getEventDetails(Number(eventId))
    );

    await prisma.event.create({
      data: {
        eventId: Number(eventId),
        eventCreator: creator,
        eventName: eventName,
        eventURI: eventDetails.eventURI,
        documentURI: eventDetails.documentURI,
        eventDate: new Date(Number(eventDetails.eventDate) * 1000),
        eventActive: eventDetails.eventActive,
        status: ['PENDING', 'APPROVED', 'REJECTED'][Number(eventDetails.status)],
        createdAt: new Date(Number(eventDetails.createdAt) * 1000),
        txHash: log.transactionHash,
        blockNumber: block.number
      }
    });

    const revenueShares = await this.retryWithBackoff(() => 
      contract.getRevenueShares(Number(eventId))
    );
    
    for (const share of revenueShares) {
      await prisma.revenueShare.create({
        data: {
          eventId: Number(eventId),
          beneficiary: share.beneficiary,
          percentage: Number(share.percentage)
        }
      });
    }

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        type: 'EVENT_CREATION',
        from: creator,
        eventId: Number(eventId),
        amount: '0',
        status: 'CONFIRMED',
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleEventApproved(log, block) {
    const [eventId, creator] = log.args;

    await prisma.event.update({
      where: { eventId: Number(eventId) },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleEventRejected(log, block) {
    const [eventId, creator] = log.args;

    await prisma.event.update({
      where: { eventId: Number(eventId) },
      data: { status: 'REJECTED' }
    });
  }

  async handleTicketTypeAdded(log, block) {
    const [eventId, typeId, typeName, price, supply] = log.args;
    
    const ticketType = await this.retryWithBackoff(() => 
      contract.getTicketType(Number(eventId), Number(typeId))
    );

    await prisma.ticketType.create({
      data: {
        typeId: Number(typeId),
        eventId: Number(eventId),
        typeName: typeName,
        price: price.toString(),
        totalSupply: Number(supply),
        sold: Number(ticketType.sold),
        saleStartTime: new Date(Number(ticketType.saleStartTime) * 1000),
        saleEndTime: new Date(Number(ticketType.saleEndTime) * 1000),
        active: ticketType.active
      }
    });

    await prisma.event.update({
      where: { eventId: Number(eventId) },
      data: { eventActive: true }
    });

    const tx = await this.retryWithBackoff(() => log.getTransaction());

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        type: 'TICKET_TYPE_ADDED',
        from: tx.from,
        eventId: Number(eventId),
        amount: '0',
        status: 'CONFIRMED',
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleTicketTypeUpdated(log, block) {
    const [eventId, typeId, price, supply] = log.args;
    
    const ticketType = await this.retryWithBackoff(() => 
      contract.getTicketType(Number(eventId), Number(typeId))
    );

    await prisma.ticketType.update({
      where: {
        eventId_typeId: {
          eventId: Number(eventId),
          typeId: Number(typeId)
        }
      },
      data: {
        price: price.toString(),
        totalSupply: Number(supply),
        saleStartTime: new Date(Number(ticketType.saleStartTime) * 1000),
        saleEndTime: new Date(Number(ticketType.saleEndTime) * 1000),
        active: ticketType.active
      }
    });
  }

  async handleTicketMinted(log, block) {
    const [ticketId, eventId, typeId, buyer] = log.args;

    await prisma.user.upsert({
      where: { address: buyer },
      create: { address: buyer, role: 'BUYER' },
      update: {}
    });

    const ticketDetails = await this.retryWithBackoff(() => 
      contract.getTicketDetails(Number(ticketId))
    );

    await prisma.ticket.create({
      data: {
        ticketId: Number(ticketId),
        eventId: Number(eventId),
        typeId: Number(typeId),
        currentOwner: buyer,
        isUsed: false,
        mintedAt: new Date(Number(ticketDetails.mintedAt) * 1000),
        txHash: log.transactionHash
      }
    });
  }

  async handleTicketsPurchased(log, block) {
    const [eventId, typeId, buyer, quantity, totalCost] = log.args;

    await prisma.ticketType.update({
      where: {
        eventId_typeId: {
          eventId: Number(eventId),
          typeId: Number(typeId)
        }
      },
      data: {
        sold: { increment: Number(quantity) }
      }
    });

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        type: 'TICKET_PURCHASE',
        from: buyer,
        eventId: Number(eventId),
        amount: totalCost.toString(),
        status: 'CONFIRMED',
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleTicketListedForResale(log, block) {
    const [ticketId, resalePrice, deadline] = log.args;

    await prisma.ticket.update({
      where: { ticketId: Number(ticketId) },
      data: {
        isForResale: true,
        resalePrice: resalePrice.toString(),
        resaleDeadline: new Date(Number(deadline) * 1000)
      }
    });
  }

  async handleTicketResold(log, block) {
    const [ticketId, from, to, price] = log.args;

    await prisma.user.upsert({
      where: { address: to },
      create: { address: to, role: 'BUYER' },
      update: {}
    });

    await prisma.ticket.update({
      where: { ticketId: Number(ticketId) },
      data: {
        currentOwner: to,
        isForResale: false,
        resalePrice: null,
        resaleDeadline: null,
        resaleCount: { increment: 1 }
      }
    });

    await prisma.transaction.create({
      data: {
        txHash: log.transactionHash,
        type: 'TICKET_RESALE',
        from: from,
        to: to,
        ticketId: Number(ticketId),
        amount: price.toString(),
        status: 'CONFIRMED',
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000)
      }
    });
  }

  async handleTicketUsed(log, block) {
    const [ticketId, eventId, user] = log.args;

    await prisma.ticket.update({
      where: { ticketId: Number(ticketId) },
      data: {
        isUsed: true,
        usedAt: new Date(block.timestamp * 1000)
      }
    });
  }

  stop() {
    this.isRunning = false;
    contract.removeAllListeners();
    logger.info('Indexer stopped');
  }
}

const indexer = new IndexerService();

if (require.main === module) {
  indexer.start().catch(console.error);
}

module.exports = indexer;