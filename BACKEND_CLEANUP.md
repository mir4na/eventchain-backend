# Backend Cleanup & Simplification Guide

## 🎯 Philosophy

**Backend = Indexer + Read-Only API + Cache Layer**

The blockchain is the source of truth. Backend only:
1. Listens to blockchain events
2. Stores data in database for fast queries
3. Serves read-only APIs

## ❌ Files to DELETE

```
src/
├── controllers/
│   ├── eventController.js          # DELETE - Logic moved to smart contract
│   └── ticketController.js         # DELETE - Logic moved to smart contract
│
├── services/
│   ├── eventService.js             # DELETE - Redundant
│   └── ticketService.js            # DELETE - Redundant
│
├── validators/
│   ├── eventValidator.js           # DELETE - Smart contract validates
│   └── ticketValidator.js          # DELETE - Smart contract validates
```

## ✅ Files to KEEP

```
src/
├── app.js                          # KEEP - Express app setup
├── config/
│   ├── blockchain.js               # KEEP - Contract ABI & config
│   ├── database.js                 # KEEP - Prisma setup
│   └── env.js                      # KEEP - Environment config
├── controllers/
│   └── adminController.js          # KEEP - Read-only queries
├── middleware/
│   ├── auth.js                     # KEEP - Optional JWT auth
│   ├── errorHandler.js             # KEEP - Error handling
│   ├── rateLimit.js                # KEEP - Rate limiting
│   └── validation.js               # KEEP - Input validation
├── routes/
│   ├── adminRoutes.js              # KEEP - Stats endpoints
│   ├── eventRoutes.js              # SIMPLIFY - Only GET
│   ├── resaleRoutes.js             # SIMPLIFY - Only GET
│   ├── ticketRoutes.js             # SIMPLIFY - Only GET
│   └── userRoutes.js               # KEEP - User preferences
├── services/
│   ├── blockchainService.js        # KEEP - Read blockchain
│   └── indexerService.js           # KEEP - Main indexer
└── utils/
    ├── helpers.js                  # KEEP - Utility functions
    ├── logger.js                   # KEEP - Logging
    └── response.js                 # KEEP - API responses
```

## 📝 Simplified Routes

### Event Routes (Read-Only)

```javascript
// src/routes/eventRoutes.js

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/events - List all events with filters
router.get('/', async (req, res) => {
  try {
    const { status, location, search, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const where = {};
    
    if (status) where.status = status;
    if (location) where.location = { contains: location, mode: 'insensitive' };
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
        ticketTypes: true,
        revenueShares: true,
      },
      orderBy: { [sortBy]: order }
    });

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { eventId: parseInt(req.params.id) },
      include: {
        creator: true,
        ticketTypes: true,
        revenueShares: true,
      }
    });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/events/:id/statistics - Get event statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    
    const tickets = await prisma.ticket.findMany({
      where: { eventId },
      include: { ticketType: true }
    });

    const totalSold = tickets.length;
    const totalRevenue = tickets.reduce((sum, ticket) => 
      sum + parseFloat(ticket.ticketType.price), 0
    );
    const usedTickets = tickets.filter(t => t.isUsed).length;

    res.json({
      success: true,
      data: {
        totalSold,
        totalRevenue,
        usedTickets,
        attendanceRate: totalSold > 0 ? (usedTickets / totalSold) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### Ticket Routes (Read-Only)

```javascript
// src/routes/ticketRoutes.js

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/tickets/user/:address - Get user's tickets
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { status, eventId } = req.query;

    const where = { currentOwner: address.toLowerCase() };
    
    if (status === 'used') where.isUsed = true;
    if (status === 'unused') where.isUsed = false;
    if (eventId) where.eventId = parseInt(eventId);

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        event: true,
        ticketType: true,
      },
      orderBy: { mintedAt: 'desc' }
    });

    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tickets/:id - Get ticket by ID
router.get('/:id', async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId: parseInt(req.params.id) },
      include: {
        event: true,
        ticketType: true,
        transactions: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tickets/:id/history - Get ticket transaction history
router.get('/:id/history', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { ticketId: parseInt(req.params.id) },
      orderBy: { timestamp: 'desc' }
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### Resale Routes (Read-Only)

```javascript
// src/routes/resaleRoutes.js

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/resale - Get all resale tickets
router.get('/', async (req, res) => {
  try {
    const { eventId, minPrice, maxPrice } = req.query;

    const where = { isForResale: true };
    
    if (eventId) where.eventId = parseInt(eventId);
    if (minPrice || maxPrice) {
      where.resalePrice = {};
      if (minPrice) where.resalePrice.gte = minPrice;
      if (maxPrice) where.resalePrice.lte = maxPrice;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        event: true,
        ticketType: true,
      },
      orderBy: { resalePrice: 'asc' }
    });

    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### User Routes (Preferences)

```javascript
// src/routes/userRoutes.js

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/users/:address/transactions - Get user's transaction history
router.get('/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const { type, eventId } = req.query;

    const where = {
      OR: [
        { from: address.toLowerCase() },
        { to: address.toLowerCase() }
      ]
    };

    if (type) where.type = type;
    if (eventId) where.eventId = parseInt(eventId);

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        event: true,
        ticket: { include: { ticketType: true } }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users/:address/favorites - Toggle favorite event
router.post('/:address/favorites', async (req, res) => {
  try {
    const { address } = req.params;
    const { eventId } = req.body;

    const existing = await prisma.userFavorite.findUnique({
      where: {
        userId_eventId: {
          userId: address.toLowerCase(),
          eventId: parseInt(eventId)
        }
      }
    });

    if (existing) {
      await prisma.userFavorite.delete({
        where: { id: existing.id }
      });
      res.json({ success: true, favorited: false });
    } else {
      await prisma.userFavorite.create({
        data: {
          userId: address.toLowerCase(),
          eventId: parseInt(eventId)
        }
      });
      res.json({ success: true, favorited: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users/:address/favorites - Get user's favorite events
router.get('/:address/favorites', async (req, res) => {
  try {
    const { address } = req.params;

    const favorites = await prisma.userFavorite.findMany({
      where: { userId: address.toLowerCase() },
      include: {
        event: {
          include: {
            ticketTypes: true
          }
        }
      }
    });

    res.json({ 
      success: true, 
      data: favorites.map(f => f.event) 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### Admin Routes (Stats Only)

```javascript
// src/routes/adminRoutes.js

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/admin/stats - Platform statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalEvents, totalTickets, totalRevenue, pendingEvents] = await Promise.all([
      prisma.event.count(),
      prisma.ticket.count(),
      prisma.transaction.aggregate({
        _sum: { amount: true }
      }),
      prisma.event.count({ where: { status: 'PENDING' } })
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalTickets,
        totalRevenue: totalRevenue._sum.amount || '0',
        pendingEvents
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/events/pending - Get pending events
router.get('/events/pending', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PENDING' },
      include: { creator: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

## 🔄 Simplified Indexer Service

```javascript
// src/services/indexerService.js

import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import eventChainABI from '../config/eventChainABI.json';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

class IndexerService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      eventChainABI,
      this.provider
    );
    this.lastProcessedBlock = parseInt(process.env.START_BLOCK || '0');
  }

  async start() {
    logger.info('Starting blockchain indexer...');
    
    // Process past events
    await this.processPastEvents();
    
    // Listen for new events
    this.listenToNewEvents();
    
    // Periodic sync
    setInterval(() => this.syncLatestBlocks(), 
      parseInt(process.env.INDEXER_INTERVAL || '15000')
    );
  }

  async processPastEvents() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      logger.info(`Processing events from block ${this.lastProcessedBlock} to ${currentBlock}`);

      // Event Created
      const eventCreatedFilter = this.contract.filters.EventCreated();
      const eventCreatedLogs = await this.contract.queryFilter(
        eventCreatedFilter,
        this.lastProcessedBlock,
        currentBlock
      );

      for (const log of eventCreatedLogs) {
        await this.handleEventCreated(log);
      }

      // Event Approved
      const eventApprovedFilter = this.contract.filters.EventApproved();
      const eventApprovedLogs = await this.contract.queryFilter(
        eventApprovedFilter,
        this.lastProcessedBlock,
        currentBlock
      );

      for (const log of eventApprovedLogs) {
        await this.handleEventApproved(log);
      }

      // Ticket Type Added
      const ticketTypeFilter = this.contract.filters.TicketTypeAdded();
      const ticketTypeLogs = await this.contract.queryFilter(
        ticketTypeFilter,
        this.lastProcessedBlock,
        currentBlock
      );

      for (const log of ticketTypeLogs) {
        await this.handleTicketTypeAdded(log);
      }

      // Tickets Purchased
      const purchaseFilter = this.contract.filters.TicketsPurchased();
      const purchaseLogs = await this.contract.queryFilter(
        purchaseFilter,
        this.lastProcessedBlock,
        currentBlock
      );

      for (const log of purchaseLogs) {
        await this.handleTicketsPurchased(log);
      }

      // Ticket Minted
      const mintFilter = this.contract.filters.TicketMinted();
      const mintLogs = await this.contract.queryFilter(
        mintFilter,
        this.lastProcessedBlock,
        currentBlock
      );

      for (const log of mintLogs) {
        await this.handleTicketMinted(log);
      }

      // Resale events...
      // Add other event handlers

      this.lastProcessedBlock = currentBlock + 1;
      logger.info(`Processed events up to block ${currentBlock}`);
    } catch (error) {
      logger.error('Error processing past events:', error);
    }
  }

  listenToNewEvents() {
    this.contract.on('EventCreated', async (...args) => {
      await this.handleEventCreated({ args });
    });

    this.contract.on('EventApproved', async (...args) => {
      await this.handleEventApproved({ args });
    });

    this.contract.on('TicketMinted', async (...args) => {
      await this.handleTicketMinted({ args });
    });

    // Add other listeners...
  }

  async handleEventCreated(log) {
    const [eventId, creator, eventName] = log.args;
    
    try {
      const eventData = await this.contract.getEventDetails(eventId);
      
      await prisma.event.upsert({
        where: { eventId: Number(eventId) },
        create: {
          eventId: Number(eventId),
          eventCreator: creator.toLowerCase(),
          eventName: eventData.eventName,
          eventURI: eventData.eventURI,
          documentURI: eventData.documentURI,
          eventDate: new Date(Number(eventData.eventDate) * 1000),
          eventActive: eventData.eventActive,
          status: this.mapEventStatus(eventData.status),
          createdAt: new Date(Number(eventData.createdAt) * 1000),
        },
        update: {}
      });

      logger.info(`Indexed event created: ${eventId}`);
    } catch (error) {
      logger.error(`Error indexing EventCreated:`, error);
    }
  }

  async handleEventApproved(log) {
    const [eventId] = log.args;
    
    try {
      const eventData = await this.contract.getEventDetails(eventId);
      
      await prisma.event.update({
        where: { eventId: Number(eventId) },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(Number(eventData.approvedAt) * 1000)
        }
      });

      logger.info(`Indexed event approved: ${eventId}`);
    } catch (error) {
      logger.error(`Error indexing EventApproved:`, error);
    }
  }

  async handleTicketTypeAdded(log) {
    const [eventId, typeId, typeName, price, supply] = log.args;
    
    try {
      const ticketTypeData = await this.contract.getTicketType(eventId, typeId);
      
      await prisma.ticketType.upsert({
        where: { 
          eventId_typeId: {
            eventId: Number(eventId),
            typeId: Number(typeId)
          }
        },
        create: {
          eventId: Number(eventId),
          typeId: Number(typeId),
          typeName: ticketTypeData.typeName,
          price: ticketTypeData.price.toString(),
          totalSupply: Number(ticketTypeData.totalSupply),
          sold: Number(ticketTypeData.sold),
          saleStartTime: new Date(Number(ticketTypeData.saleStartTime) * 1000),
          saleEndTime: new Date(Number(ticketTypeData.saleEndTime) * 1000),
          active: ticketTypeData.active
        },
        update: {}
      });

      logger.info(`Indexed ticket type added: ${eventId}-${typeId}`);
    } catch (error) {
      logger.error(`Error indexing TicketTypeAdded:`, error);
    }
  }

  async handleTicketMinted(log) {
    const [ticketId, eventId, typeId, buyer] = log.args;
    
    try {
      const ticketData = await this.contract.getTicketDetails(ticketId);
      
      await prisma.ticket.upsert({
        where: { ticketId: Number(ticketId) },
        create: {
          ticketId: Number(ticketId),
          eventId: Number(eventId),
          typeId: Number(typeId),
          currentOwner: buyer.toLowerCase(),
          isUsed: ticketData.isUsed,
          mintedAt: new Date(Number(ticketData.mintedAt) * 1000),
          isForResale: ticketData.isForResale,
          resalePrice: ticketData.resalePrice.toString(),
          resaleDeadline: ticketData.resaleDeadline > 0 
            ? new Date(Number(ticketData.resaleDeadline) * 1000) 
            : null,
          resaleCount: Number(ticketData.resaleCount)
        },
        update: {}
      });

      logger.info(`Indexed ticket minted: ${ticketId}`);
    } catch (error) {
      logger.error(`Error indexing TicketMinted:`, error);
    }
  }

  async syncLatestBlocks() {
    await this.processPastEvents();
  }

  mapEventStatus(status) {
    const statusMap = ['PENDING', 'APPROVED', 'REJECTED'];
    return statusMap[status] || 'PENDING';
  }
}

export default new IndexerService();
```

## 🗄️ Updated Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Event {
  eventId       Int            @id
  eventCreator  String
  eventName     String
  eventURI      String
  documentURI   String
  description   String?
  location      String?
  eventDate     DateTime
  eventActive   Boolean
  status        String         // PENDING, APPROVED, REJECTED
  createdAt     DateTime
  approvedAt    DateTime?
  
  ticketTypes   TicketType[]
  tickets       Ticket[]
  revenueShares RevenueShare[]
  transactions  Transaction[]
  favorites     UserFavorite[]
  
  @@index([status])
  @@index([eventCreator])
}

model TicketType {
  eventId       Int
  typeId        Int
  typeName      String
  price         String
  totalSupply   Int
  sold          Int
  saleStartTime DateTime
  saleEndTime   DateTime
  active        Boolean
  
  event         Event     @relation(fields: [eventId], references: [eventId])
  tickets       Ticket[]
  
  @@id([eventId, typeId])
  @@index([eventId])
}

model Ticket {
  ticketId       Int       @id
  eventId        Int
  typeId         Int
  currentOwner   String
  isUsed         Boolean
  mintedAt       DateTime
  usedAt         DateTime?
  isForResale    Boolean
  resalePrice    String?
  resaleDeadline DateTime?
  resaleCount    Int
  
  event          Event        @relation(fields: [eventId], references: [eventId])
  ticketType     TicketType   @relation(fields: [eventId, typeId], references: [eventId, typeId])
  transactions   Transaction[]
  
  @@index([eventId])
  @@index([currentOwner])
  @@index([isForResale])
}

model Transaction {
  id            String   @id @default(uuid())
  txHash        String   @unique
  type          String   // PURCHASE, RESALE, USE
  from          String
  to            String?
  amount        String
  timestamp     DateTime
  blockNumber   Int
  eventId       Int?
  ticketId      Int?
  
  event         Event?   @relation(fields: [eventId], references: [eventId])
  ticket        Ticket?  @relation(fields: [ticketId], references: [ticketId])
  
  @@index([from])
  @@index([to])
  @@index([eventId])
}

model RevenueShare {
  id           String @id @default(uuid())
  eventId      Int
  beneficiary  String
  percentage   Int
  
  event        Event  @relation(fields: [eventId], references: [eventId])
  
  @@index([eventId])
}

model UserFavorite {
  id       String @id @default(uuid())
  userId   String
  eventId  Int
  
  event    Event  @relation(fields: [eventId], references: [eventId])
  
  @@unique([userId, eventId])
  @@index([userId])
}
```

## 🚀 Summary

### What Changed:
1. **Removed** - All write operations from backend
2. **Simplified** - Routes to read-only
3. **Focused** - Backend is now just an indexer + API cache
4. **Blockchain First** - All state changes via smart contract

### Benefits:
- ✅ Simpler backend code
- ✅ No business logic duplication
- ✅ Blockchain is single source of truth
- ✅ Faster queries via database cache
- ✅ Easier to maintain
- ✅ More secure (no backend exploits)

### File Count Reduced:
- Before: ~15 backend files
- After: ~8 backend files (47% reduction!)
