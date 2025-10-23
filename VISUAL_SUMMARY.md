# Visual Summary - MyMineTicketKu Architecture

## 🎨 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                      │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Events  │  │   EO     │  │  Admin   │  │  Profile │      │
│  │  Page    │  │Dashboard │  │Dashboard │  │  Page    │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │              │             │             │
│       ▼             ▼              ▼             ▼             │
│  ┌─────────────────────────────────────────────────────┐      │
│  │         Blockchain Service (ethers.js)              │      │
│  │         API Client (fetch)                          │      │
│  └─────────┬───────────────────────────┬───────────────┘      │
└────────────┼───────────────────────────┼──────────────────────┘
             │                           │
             │ Write Ops                 │ Read Ops
             │ (Transactions)            │ (GET requests)
             ▼                           ▼
┌───────────────────────┐    ┌───────────────────────────┐
│  SMART CONTRACT       │    │  BACKEND API              │
│  (Sepolia Testnet)    │    │  (Express.js)             │
│                       │    │                           │
│  • createEvent()      │    │  GET /api/events          │
│  • approveEvent()     │    │  GET /api/tickets         │
│  • addTicketType()    │◄───┤  GET /api/resale          │
│  • buyTickets()       │    │  POST /api/favorites      │
│  • listForResale()    │    │                           │
│  • buyResale()        │    │  ┌──────────────────┐     │
│                       │    │  │  Indexer Service │     │
│  Emits Events ────────┼───►│  │  (Listens to     │     │
│                       │    │  │   blockchain)    │     │
└───────────────────────┘    │  └────────┬─────────┘     │
                             │           │               │
                             │           ▼               │
                             │  ┌──────────────────┐     │
                             │  │   PostgreSQL     │     │
                             │  │   (Neon)         │     │
                             │  │   • Cached Data  │     │
                             │  └──────────────────┘     │
                             └───────────────────────────┘
```

## 📊 Data Flow Diagrams

### Flow 1: Create Event (EO → Admin → Ticket Sales)

```
┌─────────┐         ┌─────────────┐         ┌────────┐
│   EO    │────1───►│ Smart       │────2───►│ Indexer│
│         │ create  │ Contract    │ Event   │        │
│         │ Event() │             │ Created │        │
└─────────┘         └─────────────┘         └───┬────┘
                                                 │
                                                 ▼
                                            ┌────────┐
                                            │Database│
                                            └────────┘
     ┌─────────┐         ┌─────────────┐
     │  Admin  │────3───►│ Smart       │
     │         │ approve │ Contract    │
     │         │ Event() │             │
     └─────────┘         └─────────────┘
                              │
                              │ 4. Event Approved
                              ▼
     ┌─────────┐         ┌─────────────┐
     │   EO    │────5───►│ Smart       │
     │         │   add   │ Contract    │
     │         │ Ticket  │             │
     │         │ Type()  │             │
     └─────────┘         └─────────────┘
                              │
                              │ 6. Tickets On Sale!
                              ▼
     ┌─────────┐         ┌─────────────┐
     │  User   │────7───►│ Smart       │
     │         │   buy   │ Contract    │
     │         │Tickets()│             │
     └─────────┘         └─────────────┘
```

### Flow 2: Ticket Purchase & Resale

```
┌─────────┐                                 ┌─────────────┐
│ User A  │────1. Buy Ticket (0.05 ETH)────►│ Smart       │
│         │                                 │ Contract    │
└─────────┘                                 └──────┬──────┘
                                                   │
                                    2. Mint NFT    │ 3. Revenue Split
                                       Ticket      │    100% to EO
                                                   ▼
                                              ┌─────────┐
                                              │   EO    │
                                              │ Wallet  │
                                              └─────────┘

┌─────────┐                                 ┌─────────────┐
│ User A  │────4. List Resale (0.06 ETH)───►│ Smart       │
│         │        (+20% markup)            │ Contract    │
└─────────┘                                 └─────────────┘
                                                   │
                                    5. Listed in   │
                                       Marketplace │
                                                   ▼
┌─────────┐                                 ┌─────────────┐
│ User B  │────6. Buy Resale (0.06 ETH)────►│ Smart       │
│         │                                 │ Contract    │
└─────────┘                                 └──────┬──────┘
                                                   │
                                    7. Split Payment
                                                   │
                     ┌─────────────┬───────────────┼───────────────┐
                     ▼             ▼               ▼               ▼
                ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
                │ User A  │   │   EO    │   │Platform │   │  Tax    │
                │ 92.5%   │   │   5%    │   │  2.5%   │   │  Gas    │
                │0.0555ETH│   │0.003ETH │   │0.0015ETH│   │ 0.001ETH│
                └─────────┘   └─────────┘   └─────────┘   └─────────┘

Note: User B CANNOT resell again (MAX_RESALE_COUNT = 1)
```

## 🏗️ Before vs After Architecture

### ❌ BEFORE (Problematic)

```
Frontend ──────► Backend API ──────► Smart Contract
                      │
                      ├─ Event Creation (❌ Duplicate)
                      ├─ Ticket Purchase (❌ Duplicate)
                      ├─ Validation (❌ Duplicate)
                      └─ Business Logic (❌ Duplicate)

Problems:
- Duplicate logic in backend & contract
- Backend becomes bottleneck
- Single point of failure
- Difficult to maintain
```

### ✅ AFTER (Optimized)

```
Frontend ──────► Smart Contract (All Write Ops)
    │
    └───────────► Backend API (Read-Only)
                      │
                      ├─ Indexer (Listen to events)
                      ├─ Cache (Fast queries)
                      └─ API (Serve data)

Benefits:
- Smart contract is source of truth
- Backend is simple cache layer
- No duplicate logic
- Faster queries
- More secure
```

## 📁 File Structure Comparison

### FRONTEND - Added Files

```
Before:                          After:
12 pages                         16 pages (+4 NEW)

                                 ✨ app/admin/dashboard/page.tsx
                                 ✨ app/eo/dashboard/page.tsx
                                 ✨ app/eo/create-event/page.tsx
                                 ✨ app/eo/events/[id]/manage/page.tsx
                                 ✨ components/ui/textarea.tsx
```

### BACKEND - Removed Files

```
Before:                          After:
15 files                         9 files (-6 DELETED)

❌ controllers/eventController    ⚡ Deleted
❌ controllers/ticketController   ⚡ Deleted
❌ services/eventService          ⚡ Deleted
❌ services/ticketService         ⚡ Deleted
❌ validators/eventValidator      ⚡ Deleted
❌ validators/ticketValidator     ⚡ Deleted

✅ services/indexerService        ✓ MAIN SERVICE (Keep)
✅ routes/* (simplified)          ✓ Read-only (Keep)
```

## 🎯 User Personas & Pages

```
┌─────────────────────────────────────────────────────────┐
│                    USER TYPES & PAGES                   │
└─────────────────────────────────────────────────────────┘

👤 Regular User (Buyer)
├── /events                     Browse events
├── /events/[id]                View event detail
├── /events/[id]/checkout       Purchase tickets
├── /profile                    View profile
├── /profile?tab=my-tickets     View owned tickets
├── /tickets/[id]               View ticket QR code
└── /explore-tickets            Explore NFT tickets

🎪 Event Organizer (EO)
├── /eo/dashboard               EO dashboard ✨ NEW
├── /eo/create-event            Create event ✨ NEW
├── /eo/events/[id]/manage      Manage tickets ✨ NEW
└── All regular user pages

👨‍💼 Admin
├── /admin/dashboard            Admin panel ✨ NEW
├── Approve/reject events
└── View platform statistics

🔐 Guest (Not Logged In)
├── /events                     Browse events (read-only)
├── /events/[id]                View details (can't buy)
├── /login                      Login page
└── /register                   Register page
```

## 💰 Revenue Flow Diagram

### Primary Sale (User → EO)

```
User pays 0.05 ETH
        │
        ▼
┌───────────────┐
│ Smart Contract│
│ buyTickets()  │
└───────┬───────┘
        │
        │ 100% to revenue beneficiaries
        ▼
┌─────────────────────────────────────┐
│  Revenue Split (set by EO)          │
├─────────────────────────────────────┤
│  EO Wallet 1:    70% = 0.035 ETH    │
│  Artist Wallet:  20% = 0.010 ETH    │
│  Venue Wallet:   10% = 0.005 ETH    │
└─────────────────────────────────────┘
        Total = 100% = 0.05 ETH
```

### Resale (User A → User B)

```
User B pays 0.06 ETH (120% of original)
        │
        ▼
┌───────────────┐
│ Smart Contract│
│buyResale()    │
└───────┬───────┘
        │
        │ Split 3 ways
        ▼
┌─────────────────────────────────────┐
│  Resale Revenue Split               │
├─────────────────────────────────────┤
│  User A (Seller):  92.5% = 0.0555ETH│
│  Original EO:       5.0% = 0.0030ETH│
│  Platform:          2.5% = 0.0015ETH│
└─────────────────────────────────────┘
        Total = 100% = 0.06 ETH
```

## 🔒 Security & Validation Layers

```
┌──────────────────────────────────────────────────────────┐
│                    VALIDATION LAYERS                     │
└──────────────────────────────────────────────────────────┘

Layer 1: Frontend (UX validation)
├── Form validation (React Hook Form)
├── Input sanitization
├── Wallet connection check
└── Balance check

        │
        ▼

Layer 2: Smart Contract (Enforced)
├── ✅ require() statements
├── ✅ Custom errors
├── ✅ Modifiers (onlyAdmin, onlyOwner)
├── ✅ State checks
├── ✅ Business rules
│   ├── Max 5 tickets per user
│   ├── Max 20% resale markup
│   ├── Max 1 resale per ticket
│   ├── Revenue shares = 100%
│   └── Event must be approved
└── ✅ ReentrancyGuard

        │
        ▼

Layer 3: Blockchain (Immutable)
├── Transaction signature
├── Gas limit
├── Nonce management
└── Consensus validation

Result: 🔐 Triple-layer security!
```

## 📊 Performance Metrics

```
┌──────────────────────────────────────────────────────────┐
│                   EXPECTED PERFORMANCE                   │
└──────────────────────────────────────────────────────────┘

Smart Contract (Sepolia)
├── Deploy: ~1-2 minutes
├── Transaction confirm: ~15-30 seconds
├── Gas cost (buy ticket): ~0.001-0.003 ETH
└── Gas cost (create event): ~0.005-0.01 ETH

Backend API
├── GET /events: <500ms
├── GET /tickets: <300ms
├── Indexer lag: ~15 seconds
└── Database query: <100ms

Frontend
├── Page load: <2 seconds
├── Wallet connect: ~3-5 seconds
├── Transaction submit: ~1 second (+ blockchain wait)
└── IPFS upload: ~5-10 seconds

Total User Flow Time
├── Browse events: Instant (cached)
├── Buy ticket: ~20-40 seconds (blockchain)
├── View ticket: Instant (NFT owned)
└── List resale: ~20-40 seconds (blockchain)
```

## 🎯 Business Rules Summary

```
┌──────────────────────────────────────────────────────────┐
│              BLOCKCHAIN-ENFORCED RULES                   │
└──────────────────────────────────────────────────────────┘

Purchase Limits
├── Max 5 tickets per transaction   (MAX_TICKETS_PER_PURCHASE)
├── Max 5 tickets per user per event(MAX_TICKETS_PER_USER)
└── Must have sufficient ETH balance

Resale Rules
├── Max 20% markup allowed          (MAX_RESALE_PERCENTAGE = 120)
├── Max 1 resale per ticket         (MAX_RESALE_COUNT = 1)
├── Must set deadline
└── Original owner gets 5% royalty

Revenue Rules
├── Primary sale: 100% to EO beneficiaries
├── Resale: 92.5% seller, 5% EO, 2.5% platform
├── Split percentages must = 100%  (BASIS_POINTS = 10000)
└── Automatic distribution (no manual payout)

Event Rules
├── Must be approved by admin
├── Can only add tickets if approved
├── Sale times must be valid
└── EO can deactivate event
```

---

## ✅ Final Checklist

```
Frontend
├── [✅] 12 existing pages working
├── [✨] 4 new pages added
├── [⚠️] Navbar needs update
└── [🔧] Connect to backend API

Backend
├── [❌] Delete 6 unnecessary files
├── [⚠️] Simplify routes to GET-only
├── [🔧] Update indexer service
└── [🗄️] Update database schema

Smart Contract
├── [✅] Already deployed
├── [✅] All functions working
├── [✅] Events emitting correctly
└── [⚠️] Verify on Etherscan

Integration
├── [🔧] Frontend ↔ Blockchain (ethers.js)
├── [🔧] Frontend ↔ Backend (API calls)
├── [🔧] Backend ↔ Blockchain (indexer)
└── [🔧] IPFS ↔ Pinata (file upload)
```

---

**Visual Guide Complete!** ✅

Use this as your reference while implementing the changes.
