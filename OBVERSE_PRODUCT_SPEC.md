# Obverse — Product Specification

> Last Updated: April 9, 2026
> Version: 1.1 (Implementation-Aware)

---

## 📌 Executive Summary

**Obverse** is a social finance platform for stablecoin payments, embedded natively in WhatsApp, Far­caster, and Telegram. It enables merchants and users to create invoices, payment links, receipts, and crowdfunding campaigns — all through conversational AI agents. The platform supports **multiple chains** (Solana, Base, Monad) and includes a **privacy mode** for confidential transactions using stealth addresses.

**Mission:** Make stablecoin payments as easy as sending a text message.

---

## 🎯 Product Vision

> "The first privacy-first, multi-chain stablecoin payment platform that works where your customers already are — WhatsApp, Far­caster, Telegram — powered by AI agents."

---

## 🏗️ ACTUAL IMPLEMENTATION STATUS

### ✅ Completed

| Component | Status | Details |
|-----------|--------|---------|
| **Backend** | ✅ Complete | NestJS + MongoDB |
| **Telegram Bot** | ✅ Full | `/start`, `/payment`, `/links`, `/wallet`, `/transactions`, `/balance`, `/send`, `/settings`, `/dashboard` |
| **WhatsApp (Phase 1)** | ✅ Basic | Webhook, onboarding, balance, help |
| **Wallet (Turnkey)** | ✅ Working | MPC-based wallet creation + signing |
| **Multi-chain** | ✅ Solana + Base + Monad | Solana, Base, Monad testnet |
| **Payment Links** | ✅ Working | Create, view, list, deactivate, delete |
| **Database** | ✅ MongoDB | Merchants, payment links, transactions |

### ⏳ In Progress / Not Started

| Component | Status | Priority |
|-----------|--------|----------|
| **WhatsApp Payment Links** | ❌ Not started | High |
| **WhatsApp Full Commands** | ❌ Not started | High |
| **Privacy Mode** | ❌ Not started | High |
| **Farcaster** | ❌ Not started | Medium |
| **Crowdfunding** | ❌ Not started | Medium |
| **Pi Agent** | ❌ Not started | Low |

---

## 👥 Target Users

| Segment | Use Case | Pain Points |
|---------|----------|-------------|
| **Merchants** | Invoicing, recurring payments, crowdfunding | High payment processing fees, slow settlement, complex crypto |
| **Freelancers** | Invoice clients, receive stablecoin globally | Cross-border friction, invoice management |
| **E-commerce** | Checkout links, payment pages | Lack of crypto payment options |
| **Crowdfund organizers** | Campaign pages, escrow | Centralized platform fees, lack of transparency |
| **Privacy-conscious users** | Confidential payments | Public transaction history, exposed business relationships |

---

## 🔄 Current User Journey (Telegram - Complete)

```
User (Telegram)
        │
        ▼
┌───────────────────────────────────┐
│  Send /start                      │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│  Wallet created via Turnkey       │
│  → Solana address                 │
│  → Ethereum/Base/Monad address    │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│  Send /payment                    │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│  Conversation flow:               │
│  1. Custom fields (name, email)   │
│  2. Amount + Token (USDC, SOL)    │
│  3. Chain (Solana/Base/Monad)     │
│  4. Description                   │
│  5. Reusable?                     │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│  Payment link generated           │
│  → Short link ID (nanoid 8)       │
│  → Shareable URL                  │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│  Customer clicks → pays           │
│  → On-chain confirmation          │
│  → Merchant notified             │
└───────────────────────────────────┘
```

---

## 📊 Technical Architecture (AS BUILT)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
├──────────────────┬──────────────────┬──────────────────────────────┤
│   WhatsApp       │    Telegram      │   Web Dashboard              │
│  (Kapso API)     │   (Telegraf)     │   (React + API)              │
└────────┬─────────┴────────┬─────────┴──────────────┬───────────────┘
         │                  │                         │
         ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NESTJS BACKEND                                 │
├──────────────────┬─────────────────────────────────────────────────┤
│ WhatsApp Module  │  Telegram Gateway                                │
│ - webhook        │  - Commands: /start, /payment, /links,          │
│ - basic commands │    /wallet, /transactions, /balance,            │
│                  │    /send, /settings, /dashboard                 │
│                  │  - Conversation Manager (multi-step flows)      │
├──────────────────┴─────────────────────────────────────────────────┤
│                      MESSAGING CORE                                 │
│  - InvoiceApplicationService                                        │
│  - MerchantOnboardingService (Telegram + WhatsApp)                 │
├──────────────────────────────────────────────────────────────────────┤
│                      CORE MODULES                                   │
│  - Merchants (MongoDB)                                              │
│  - PaymentLinks (create, list, view, deactivate, delete)           │
│  - Transactions (track incoming payments)                          │
│  - Wallet (Turnkey MPC)                                             │
│  - Blockchain (Solana RPC, Base RPC, Monad RPC)                    │
│  - Auth (JWT for dashboard)                                         │
│  - API Keys (for external integrations)                            │
│  - Preview (Dynamic OG images)                                      │
├─────────────────────────────────────────────────────────────────────┤
│                      DATABASE (MongoDB)                             │
│  - Merchants (telegramId, whatsappId, walletAddress, etc.)         │
│  - PaymentLinks (linkId, amount, token, chain, status)             │
│  - Transactions (txHash, amount, status, paymentLinkId)            │
│  - ConversationStates (Telegram conversation state)                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack (AS BUILT)

| Layer | Technology | Status |
|-------|------------|--------|
| **Backend** | NestJS | ✅ |
| **Database** | MongoDB (Mongoose) | ✅ |
| **Telegram** | Telegraf | ✅ |
| **WhatsApp** | Kapso API (`@kapso/whatsapp-cloud-api`) | ✅ Phase 1 |
| **Wallet** | Turnkey SDK (MPC) | ✅ |
| **Solana** | `@solana/web3.js` + Helius RPC | ✅ |
| **Base** | ethers.js + Alchemy/Public RPC | ✅ |
| **Monad** | ethers.js + Monad testnet RPC | ✅ |
| **Auth** | JWT | ✅ |
| **Config** | `@nestjs/config` | ✅ |

---

## 🔐 WhatsApp Implementation (Current)

### Already Done
```typescript
// whatsapp.service.ts - Already implemented
- processWebhookPayload() - handles incoming messages
- handleInboundMessage() - routes to handlers
- handleStart() - creates/accesses account via MerchantOnboardingService
- handleBalance() - shows wallet addresses
- Using Kapso API (not direct Meta)
- Phone number ID: 1026241053901687
```

### What's Missing (Priority Order)

1. **Payment Link Creation** - `/payment` equivalent
2. **List Links** - `/links` equivalent
3. **View Link** - `/link [id]` equivalent
4. **Transactions** - `/transactions` equivalent
5. **Send** - `/send` equivalent (P2P)
6. **Settings** - `/settings` equivalent
7. **Dashboard** - `/dashboard` equivalent

### WhatsApp Limitations to Handle

| Challenge | Solution |
|-----------|----------|
| 24-hour window | Use message templates for post-24h messages |
| Template approval | Pre-approve: payment received, payment due, invoice |
| Rate limits (1K/day) | Queue + batch notifications |
| No rich UI | Use structured messages + link previews |

---

## 📂 Key Source Files

### WhatsApp
```
src/whatsapp/
├── whatsapp.module.ts      # Module definition
├── whatsapp.controller.ts  # Webhook endpoint
└── whatsapp.service.ts     # Message handling (Phase 1)
```

### Telegram (Reference for WhatsApp)
```
src/telegram/
├── telegram.module.ts
├── telegram.gateway.ts     # Bot setup + command registration
├── telegram.service.ts     # (empty - handlers separate)
├── telegram.controller.ts
├── handlers/
│   ├── start.handler.ts
│   ├── create-link.handler.ts    # KEY - payment flow
│   ├── list-links.handler.ts
│   ├── view-link.handler.ts
│   ├── wallet.handler.ts
│   ├── balance.handler.ts
│   ├── send.handler.ts
│   ├── transactions.handler.ts
│   ├── settings.handler.ts
│   ├── dashboard.handler.ts
│   └── help.handler.ts
└── conversation/
    └── conversation.manager.ts   # Multi-step flow state
```

### Core Services
```
src/
├── merchants/merchants.service.ts     # findByWhatsappId, getOrCreateWhatsappMerchant
├── payment-links/payment-links.service.ts  # createPaymentLink, findByLinkId
├── wallet/services/wallet.service.ts  # Turnkey integration
├── blockchain/services/evm.service.ts # Base + Monad
└── messaging-core/
    ├── invoice-application.service.ts
    └── merchant-onboarding.service.ts  # Onboards Telegram + WhatsApp
```

---

## 🗺️ Roadmap (Revised)

### Phase 1: WhatsApp Parity (Weeks 1-4)

- [ ] Copy Telegram handlers to WhatsApp module
- [ ] Implement `/payment` equivalent (create payment link via chat)
- [ ] Implement `/links` equivalent (list payment links)
- [ ] Implement `/link [id]` (view single link + payments)
- [ ] Implement `/transactions` (view payment history)
- [ ] Add WhatsApp message templates for 24h window

### Phase 2: Privacy Mode (Weeks 5-8)

- [ ] Implement stealth address generation
- [ ] Add privacy option to payment link creation
- [ ] Relayer for stealth sweep on Solana
- [ ] Privacy option for Base (EVM stealth)
- [ ] Test with real users

### Phase 3: Expansion (Weeks 9-12)

- [ ] **Farcaster Frames** - payment frames
- [   **Crowdfunding** - campaign creation + escrow
- [ ] **Pi Agent** - native integration
- [ ] **Umbra SDK** - confidential balances (Phase 2)

### Phase 4: Scale (Months 4-6)

- [ ] Arcium integration (confidential computing)
- [ ] Cross-chain intent settlement
- [ ] Mobile app (iOS/Android)
- [ ] Merchant dashboard improvements

---

## 🔧 Environment Variables (AS CONFIGURED)

```env
# Database
MONGODB_URI=mongodb+srv://.../obverse_launch

# Telegram
TELEGRAM_BOT_TOKEN=8382356831:AAG0lD30H9O75UV-...

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=1026241053901687
WHATSAPP_VERIFY_TOKEN=obverse-whatsapp-webhook-secret
KAPSO_API_KEY=...

# Turnkey
TURNKEY_ORGANIZATION_ID=babcb26a-78b1-4686-a476-...
TURNKEY_API_PUBLIC_KEY=02369eabe9de8ac2670f5b83299ca3cf...
TURNKEY_API_PRIVATE_KEY=d6f7f23061e31ea6df2ec507299cc09...
TURNKEY_API_BASE_URL=https://api.turnkey.com

# Blockchain RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=https://mainnet.base.org
MONAD_RPC_URL=https://rpc.monad.xyz

# Tokens
BASE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
MONAD_USDC_ADDRESS=0x754704bc059f8c67012fed69bc8a327a5aafb603

# Auth
JWT_SECRET=obverse_secret_key_001

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Preview Images
PREVIEW_BASE_URL=https://www.obverse.cc
PREVIEW_SIGNING_SECRET=...
```

---

## 🔑 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payment-links` | POST | Create payment link |
| `/payment-links` | GET | List merchant's links |
| `/payment-links/:linkId` | GET | Get link details |
| `/payment-links/:linkId` | DELETE | Delete link |
| `/merchants/telegram/:telegramId` | GET | Get merchant by Telegram |
| `/merchants/whatsapp/:whatsappId` | GET | Get merchant by WhatsApp |
| `/wallet/address/:userId` | GET | Get wallet addresses |
| `/transactions` | GET | List transactions |

---

## 🎯 How to Build WhatsApp (Quick Start)

### Step 1: Copy Telegram Handler Pattern

The WhatsApp service needs handlers like the Telegram ones. Create:

```typescript
// src/whatsapp/handlers/create-link.handler.ts
// Similar to src/telegram/handlers/create-link.handler.ts
// But use WhatsApp message format (no inline keyboards, use text menus)
```

### Step 2: Update WhatsApp Service

```typescript
// src/whatsapp/whatsapp.service.ts
// Add:
// - handleCreateLink()
// - handleListLinks()
// - handleViewLink()
// - handleTransactions()
// - handleSend()
// - handleSettings()
```

### Step 3: Add Message Templates

For the 24-hour window issue, pre-register these templates:
- `PAYMENT_RECEIVED` - "You received {amount} {token}"
- `PAYMENT_DUE` - "Payment of {amount} due for {description}"
- `INVOICE_CREATED` - "Invoice #{id} created: {amount}"

### Step 4: Privacy Mode

After basic WhatsApp is working, add stealth addresses:

```typescript
// src/whatsapp/privacy/
// - stealth-address.service.ts
// - Uses Turnkey key derivation
// - One-time address per invoice
```

---

## 📚 References

- Kapso API: https://kapso.ai
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
- Telegraf (Telegram): https://telegraf.js.org
- Turnkey: https://docs.turnkey.com
- NestJS: https://docs.nestjs.com
- MongoDB: https://docs.mongodb.com

---

## ✅ Definition of Done (WhatsApp Full)

- [ ] User can create invoice via WhatsApp chat
- [ ] Payment link generated and sent to customer
- [ ] Customer can pay with USDC on Solana/Base/Monad
- [ ] On-chain receipt generated and stored
- [ ] Both parties receive payment confirmation
- [ ] User can list/view their payment links
- [ ] User can view transaction history
- [ ] System handles 24-hour WhatsApp window gracefully
- [ ] Privacy mode (stealth address) available

---

## 🚀 Next Steps for Pi Agent

1. **Read the Telegram handlers** in `src/telegram/handlers/` to understand the flow
2. **Create WhatsApp equivalents** in `src/whatsapp/handlers/`
3. **Update whatsapp.service.ts** to route messages to handlers
4. **Test payment link creation** via WhatsApp
5. **Add privacy mode** (stealth addresses) after basic flow works

**Start by reading:** `src/telegram/handlers/create-link.handler.ts` — this is the main payment flow you need to replicate for WhatsApp.

---

*Built by Obverse Team — Privacy-first social finance.*
*Last updated based on actual codebase: April 9, 2026*