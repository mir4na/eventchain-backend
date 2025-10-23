# MyMineTicketKu - Integration & Cleanup Guide

## 📁 File Structure

### Frontend - New Pages Added

```
app/
├── admin/
│   └── dashboard/
│       └── page.tsx                    # ✅ NEW - Admin dashboard
├── eo/
│   ├── dashboard/
│   │   └── page.tsx                    # ✅ NEW - EO dashboard
│   ├── create-event/
│   │   └── page.tsx                    # ✅ NEW - Create event form
│   └── events/
│       └── [id]/
│           └── manage/
│               └── page.tsx            # ✅ NEW - Manage event & ticket types
├── events/
│   ├── page.tsx                        # ✅ EXISTING - Events listing
│   ├── loading.tsx                     # ✅ EXISTING
│   └── [id]/
│       ├── page.tsx                    # ✅ EXISTING - Event detail
│       └── checkout/
│           └── page.tsx                # ✅ EXISTING - Checkout
├── explore-tickets/
│   ├── page.tsx                        # ✅ EXISTING - Explore tickets
│   └── loading.tsx                     # ✅ EXISTING
├── tickets/
│   └── [id]/
│       └── page.tsx                    # ✅ EXISTING - Ticket detail
├── profile/
│   └── page.tsx                        # ✅ EXISTING - User profile
├── login/
│   └── page.tsx                        # ✅ EXISTING
├── register/
│   └── page.tsx                        # ✅ EXISTING
├── layout.tsx                          # ✅ EXISTING
└── page.tsx                            # ✅ EXISTING - Homepage

components/
├── ui/
│   ├── badge.tsx                       # ✅ EXISTING
│   ├── button.tsx                      # ✅ EXISTING
│   ├── card.tsx                        # ✅ EXISTING
│   ├── checkbox.tsx                    # ✅ EXISTING
│   ├── input.tsx                       # ✅ EXISTING
│   ├── label.tsx                       # ✅ EXISTING
│   └── textarea.tsx                    # ✅ NEW - Textarea component
├── conditional-navbar.tsx              # ✅ EXISTING
└── navbar.tsx                          # ⚠️ NEEDS UPDATE

lib/
├── api.ts                              # ✅ EXISTING
├── blockchain.ts                       # ✅ EXISTING  
├── utils.ts                            # ✅ EXISTING
└── web3-providers.tsx                  # ✅ EXISTING
```

## 🔄 Files That Need Updates

### 1. Update `components/navbar.tsx`

Add navigation links for Admin and EO dashboards:

```typescript
// After line 72 (after "Explore Tickets" link), add:

<Link href="/eo/dashboard">
  <Button
    variant="ghost"
    className="font-body text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white md:text-base"
  >
    EO Dashboard
  </Button>
</Link>
<Link href="/admin/dashboard">
  <Button
    variant="ghost"
    className="font-body text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white md:text-base"
  >
    Admin
  </Button>
</Link>

// Also add these links to the mobile menu section (around line 115)
```

### 2. Update `lib/blockchain.ts`

No changes needed - already has all required methods.

### 3. Update `lib/api.ts`

No changes needed - already has all required API methods.

## 🗑️ Backend - What to Remove

### Files to DELETE Completely:

```
src/
├── controllers/
│   ├── eventController.js              # ❌ DELETE - Move logic to indexer
│   └── ticketController.js             # ❌ DELETE - Move logic to indexer
├── services/
│   ├── eventService.js                 # ❌ DELETE - Redundant
│   └── ticketService.js                # ❌ DELETE - Redundant
├── validators/
│   ├── eventValidator.js               # ❌ DELETE - Validation in smart contract
│   └── ticketValidator.js              # ❌ DELETE - Validation in smart contract
```

### Files to KEEP and UPDATE:

```
src/
├── controllers/
│   └── adminController.js              # ✅ KEEP - For admin queries only
├── services/
│   ├── blockchainService.js            # ✅ KEEP - For reading blockchain
│   └── indexerService.js               # ✅ KEEP - Main service
├── routes/
│   ├── adminRoutes.js                  # ✅ KEEP - Read-only endpoints
│   ├── eventRoutes.js                  # ⚠️ SIMPLIFY - Only GET endpoints
│   ├── resaleRoutes.js                 # ⚠️ SIMPLIFY - Only GET endpoints
│   ├── ticketRoutes.js                 # ⚠️ SIMPLIFY - Only GET endpoints
│   └── userRoutes.js                   # ✅ KEEP - User preferences
```

## 📝 Backend Role Clarification

### ❌ What Backend Should NOT Do:
- Create events (smart contract only)
- Approve/reject events (smart contract only)
- Buy tickets (smart contract only)
- Resell tickets (smart contract only)
- Validate business logic (smart contract handles this)

### ✅ What Backend SHOULD Do:
- **Index blockchain events** via `indexerService.js`
- **Cache data** in database for faster queries
- **Serve read-only APIs** for:
  - Event listings with filters
  - Ticket information
  - Transaction history
  - User's tickets and favorites
- **Handle off-chain data**:
  - User favorites/bookmarks
  - Search and filtering
  - Event metadata (descriptions, images)

## 🔧 Updated Backend Routes Structure

### Keep Only These Routes:

```javascript
// eventRoutes.js - READ ONLY
router.get('/events', getEvents)                      // List all events
router.get('/events/:id', getEventById)               // Get event details
router.get('/events/:id/statistics', getEventStats)   // Event statistics

// ticketRoutes.js - READ ONLY
router.get('/tickets/user/:address', getUserTickets)  // User's tickets
router.get('/tickets/:id', getTicketById)             // Ticket details
router.get('/tickets/:id/history', getTicketHistory)  // Transaction history

// resaleRoutes.js - READ ONLY
router.get('/resale', getResaleTickets)               // List resale tickets
router.get('/resale/event/:id', getEventResaleTickets)

// userRoutes.js - USER PREFERENCES
router.get('/users/:address/transactions', getUserTransactions)
router.post('/users/:address/favorites', toggleFavorite)
router.get('/users/:address/favorites', getUserFavorites)

// adminRoutes.js - STATS ONLY (No write operations)
router.get('/admin/stats', getAdminStats)             // Platform statistics
router.get('/admin/events/pending', getPendingEvents) // Pending events list
```

## 🔒 Smart Contract Handles All Writes

All write operations go through smart contract:

```typescript
// Event creation
await contract.createEvent(name, uri, documentURI, date, beneficiaries, percentages)

// Event approval (admin only)
await contract.approveEvent(eventId)

// Event rejection (admin only)
await contract.rejectEvent(eventId)

// Add ticket type
await contract.addTicketType(eventId, name, price, supply, saleStart, saleEnd)

// Buy tickets
await contract.buyTickets(eventId, typeId, quantity, { value: totalCost })

// List for resale
await contract.listTicketForResale(ticketId, price, deadline)

// Buy resale ticket
await contract.buyResaleTicket(ticketId, { value: price })
```

## 📊 Indexer Service Flow

```
Blockchain Event Emitted
        ↓
Indexer Listens (indexerService.js)
        ↓
Parse Event Data
        ↓
Store in Database (Prisma + Neon)
        ↓
API Serves Cached Data
```

### Events to Index:

```javascript
// From Smart Contract
EventCreated(eventId, creator, eventName)
EventApproved(eventId, creator)
EventRejected(eventId, creator)
TicketTypeAdded(eventId, typeId, name, price, supply)
TicketsPurchased(eventId, typeId, buyer, quantity, cost)
TicketMinted(ticketId, eventId, typeId, buyer)
TicketListedForResale(ticketId, price, deadline)
TicketResold(ticketId, from, to, price)
TicketUsed(ticketId, eventId, user)
```

## 🎨 Frontend Integration Steps

### 1. Connect Wallet

```typescript
import { blockchainService } from '@/lib/blockchain'

const address = await blockchainService.connectWallet()
```

### 2. Create Event (EO)

```typescript
const contract = await blockchainService.getContract()
const tx = await contract.createEvent(
  eventName,
  eventURI,
  documentURI,
  timestamp,
  [address1, address2],
  [5000, 5000] // 50% each (in basis points)
)
await tx.wait()
```

### 3. Approve Event (Admin)

```typescript
const contract = await blockchainService.getContract()
const tx = await contract.approveEvent(eventId)
await tx.wait()
```

### 4. Add Ticket Types (EO)

```typescript
const contract = await blockchainService.getContract()
const priceWei = ethers.parseEther('0.05') // 0.05 ETH
const tx = await contract.addTicketType(
  eventId,
  'VIP',
  priceWei,
  100, // supply
  saleStartTimestamp,
  saleEndTimestamp
)
await tx.wait()
```

### 5. Buy Tickets (User)

```typescript
const contract = await blockchainService.getContract()
const totalCost = ethers.parseEther('0.15') // 3 tickets x 0.05 ETH
const tx = await contract.buyTickets(eventId, typeId, 3, {
  value: totalCost
})
await tx.wait()
```

### 6. Fetch Data from Backend

```typescript
import { apiClient } from '@/lib/api'

// Get events
const events = await apiClient.getEvents({ status: 'APPROVED' })

// Get user's tickets
const tickets = await apiClient.getUserTickets(address)

// Get event details
const event = await apiClient.getEventById(eventId)
```

## 🚀 Deployment Checklist

### Smart Contract (Sepolia)
- [x] Smart contract deployed
- [ ] Verify contract on Etherscan
- [ ] Set platform wallet
- [ ] Add initial admin

### Backend (Fly.io)
- [ ] Remove unnecessary controllers/services
- [ ] Configure indexer to start from block 0
- [ ] Set up environment variables
- [ ] Deploy to Fly.io
- [ ] Configure Prisma migrations
- [ ] Start indexer service

### Frontend (Vercel)
- [ ] Add new pages (admin, eo dashboards)
- [ ] Update navbar
- [ ] Set environment variables
- [ ] Deploy to Vercel
- [ ] Test wallet connection
- [ ] Test all user flows

## 🔐 Environment Variables Summary

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=https://your-backend.fly.dev/api
NEXT_PUBLIC_CONTRACT_ADDRESS=0x1cE81D7A4bcBE....
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_PINATA_JWT=YOUR_PINATA_JWT  # For IPFS uploads
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://...
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CONTRACT_ADDRESS=0x1cE81D7A4bcBE....
CHAIN_ID=11155111
INDEXER_INTERVAL=15000
START_BLOCK=0
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
```

### Smart Contract (.env)
```bash
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_KEY
PLATFORM_WALLET=0x...
INITIAL_ADMIN=0x...
```

## 🎯 Critical Features Verification

### User Flow:
- [ ] Can connect wallet
- [ ] Can browse events
- [ ] Can buy tickets
- [ ] Can view owned tickets
- [ ] Can resell tickets (max 20% markup)
- [ ] Can view transaction history

### EO Flow:
- [ ] Can create event
- [ ] Can add ticket types after approval
- [ ] Can view event statistics
- [ ] Can manage ticket sales

### Admin Flow:
- [ ] Can approve events
- [ ] Can reject events
- [ ] Can view platform statistics
- [ ] Can see pending events

### Business Rules Enforced:
- [ ] Max 5 tickets per user per event
- [ ] Resale max 20% markup
- [ ] Max 1 resale (2 total transactions)
- [ ] Revenue sharing works (5% to EO, 2.5% to platform on resale)
- [ ] QR code verification works
- [ ] Tickets can't be used twice

## 📱 Pages Checklist

### ✅ Completed Pages:
1. Homepage (events listing) - `/events`
2. Event Detail - `/events/[id]`
3. Checkout - `/events/[id]/checkout`
4. Profile - `/profile`
5. My Tickets - `/profile?tab=my-tickets`
6. Ticket Detail - `/tickets/[id]`
7. Explore Tickets - `/explore-tickets`
8. Login - `/login`
9. Register - `/register`
10. **Admin Dashboard** - `/admin/dashboard` ✨ NEW
11. **EO Dashboard** - `/eo/dashboard` ✨ NEW
12. **Create Event** - `/eo/create-event` ✨ NEW
13. **Manage Event** - `/eo/events/[id]/manage` ✨ NEW

### All Required Pages = ✅ Complete!

## 🐛 Common Issues & Solutions

### Issue: "Transaction Failed"
- Check wallet has enough ETH for gas
- Verify contract address is correct
- Check sale period is active

### Issue: "Event not showing"
- Wait for indexer to process (15 seconds)
- Check event status (must be APPROVED)
- Verify blockchain sync

### Issue: "Can't approve event (Admin)"
- Verify admin status on contract
- Check event is in PENDING status
- Only admins can approve

### Issue: "Can't add ticket types"
- Event must be APPROVED first
- Verify you're the event creator
- Check sale times are valid

## 🔍 Testing Guide

### Test as User:
1. Connect wallet
2. Browse events
3. Buy ticket (ensure enough ETH)
4. View ticket in profile
5. Try reselling ticket
6. Check transaction history

### Test as EO:
1. Connect wallet
2. Create event
3. Wait for admin approval (or approve via admin account)
4. Add ticket types
5. Monitor sales

### Test as Admin:
1. Connect wallet with admin privileges
2. View pending events
3. Approve/reject events
4. View platform stats

---

**Last Updated:** 2025-10-23
**Version:** 1.0
**Status:** Ready for Integration ✅
