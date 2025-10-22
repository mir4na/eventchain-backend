# MyMineTicketKu - NFT Ticketing Platform

## 📖 Overview

MyMineTicketKu is a decentralized NFT ticketing platform that enables event organizers to create and manage events, sell NFT tickets, and automatically distribute revenue to stakeholders. The platform includes anti-scalping mechanisms and provides transparent revenue sharing.

## 🏗️ Architecture

### Backend Stack
- Node.js with Express.js
- PostgreSQL with Prisma ORM
- Ethers.js for blockchain interactions
- Winston for logging
- Helmet for security
- CORS for cross-origin requests

## 📊 API Endpoints

### Admin Routes
- `POST /api/admin/add` – Add new admin  
- `POST /api/admin/remove` – Remove admin  
- `POST /api/admin/events/:eventId/approve` – Approve event  
- `POST /api/admin/events/:eventId/reject` – Reject event  
- `GET /api/admin/stats` – Get admin statistics  
- `GET /api/admin/events/pending` – Get pending events  
- `GET /api/admin/verify/:address` – Verify admin status  

### Event Routes
- `GET /api/events` – Get all events (with filters)  
- `GET /api/events/:eventId` – Get event by ID  
- `GET /api/events/creator/:address` – Get events by creator  
- `GET /api/events/:eventId/statistics` – Get event statistics  
- `POST /api/events/:eventId/favorite` – Toggle favorite  
- `GET /api/events/favorites/:userId` – Get user favorites  

### Ticket Routes
- `GET /api/tickets/user/:address` – Get user tickets  
- `GET /api/tickets/resale` – Get resale tickets  
- `GET /api/tickets/:ticketId` – Get ticket by ID  
- `GET /api/tickets/:ticketId/history` – Get ticket transaction history  
- `GET /api/tickets/availability/:eventId/:typeId` – Check ticket availability  
- `GET /api/tickets/eligibility/:address/:eventId` – Check purchase eligibility  

### User Routes
- `GET /api/users/:address/tickets` – Get user tickets  
- `GET /api/users/:address/transactions` – Get user transaction history  
- `GET /api/users/:address/events` – Get user created events  
- `GET /api/users/:address/purchases` – Get user purchases  
- `GET /api/users/:address/resales` – Get user resales  

## 🔄 Indexer Service

The backend includes a real-time indexer that:
- Monitors blockchain events  
- Syncs on-chain data with the database  
- Handles event creation, ticket minting, and resales  
- Manages transaction history  

## 🛡️ Security Features

- Rate limiting  
- CORS protection  
- Helmet security headers  
- Input validation  
- Admin authentication  

## 📋 Environment Variables

| Variable           | Description                              | Example                                      |
|--------------------|------------------------------------------|----------------------------------------------|
| `DATABASE_URL`     | PostgreSQL connection string             | `postgresql://user:pass@localhost:5432/db`   |
| `RPC_URL`          | Ethereum RPC provider URL                | `https://rpc.ankr.com/eth`                   |
| `CONTRACT_ADDRESS` | Deployed smart contract address          | `0x123...abc`                                |
| `PORT`             | Server port                              | `3000`                                       |
| `NODE_ENV`         | Environment mode                         | `development` / `production`                 |
| `CORS_ORIGIN`      | Allowed frontend origin                  | `http://localhost:3000`                      |
| `START_BLOCK`      | Block number to start indexing from      | `0`                                          |