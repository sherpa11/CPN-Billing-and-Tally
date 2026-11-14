# CPN VEGETABLES – Wholesale Market Billing & Business Management System
**Gandhi Market, Dindigul, Tamil Nadu**

A production-grade, ultra-fast, user-friendly wholesale vegetable market billing and accounting system engineered specifically for **CPN VEGETABLES**. The design and print architecture reproduce the authentic shop receipt layout, complete with the Lakshmi logo, Tamil deity invocation, green border theme, 6-column billing table, and customer balance calculations.

---

## 1. Shop Identity & Reference Design

- **Shop Name**: CPN VEGETABLES
- **Deity Header**: ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை
- **Invocation**: உ
- **Tamil Subtitle**: இங்கிலீஷ் காய்கனி கமிஷன் மண்டி
- **Market Address**: 22-A, காந்தி மார்க்கெட், திண்டுக்கல்.
- **Contact Numbers**: 97152 67025, 97882 29090
- **Blessing Footer**: வாழ்க வளமுடன்
- **Theme Palette**: Primary Dark Green (`#034D28`), Secondary White (`#FFFFFF`), Text Dark Green / Black

---

## 2. Core Functional Highlights

### Dynamic Vegetable Management
- **Unlimited Vegetable Entries**: Fully dynamic, backed by MongoDB. No hardcoded vegetable items.
- **Dual Language**: Seamless Tamil & English vegetable names (e.g. *Tomato / தக்காளி*, *Onion / வெங்காயம்*, *Chow Chow / சௌ சௌ*).
- **Inline Quick-Add While Billing**: If a vegetable is not present in the master list, the operator can type its name and click **"+ Add New Vegetable"** right from the billing screen. It is saved immediately to the Vegetable Master, selected in the current bill, and available for all future bills without ever leaving the billing screen.
- **Smart Autocomplete**: Vegetables sorted by usage frequency so the most common items appear first.

### Main Billing System
- **Exact 6-Column Layout**:
  `| RATE | PARTICULARS | BAG | WEIGHT | DEBIT | CREDIT |`
- **Ultra-Fast Keyboard Navigation**:
  - `Enter` moves seamlessly: **Rate** ➔ **Particulars** ➔ **Bag** ➔ **Weight** ➔ **Debit** ➔ **Credit** ➔ **Next Row**.
  - On the last row, pressing Enter on Credit automatically appends a new row and focuses its Rate.
  - **IME-Safe**: Fully compliant with modern web guidance for Indic/Tamil input methods (`isComposing` and `keyCode === 229` check) to prevent premature submission while typing in Tamil.
- **Auto-Calculations**:
  - `Debit = Rate × Weight` (or manually entered).
  - Total Bags, Total Weight, Total Debit, Total Credit update in real time.
- **Customer Accounting Logic**:
  - `Closing Balance = Previous Balance + Total Debit - Total Credit - Cash Received`
  - When a customer is selected, their current balance is automatically loaded as the Previous Balance.
  - Cash received at bill time is logged as a traceable payment transaction. Never double-counted.

### High-Fidelity Printing System
- **Exact Reproduction of the Reference Receipt**:
  - Authentic `#034D28` dark green double border with rounded corners.
  - Top Lakshmi/CPN emblem, deity invocation (`உ` & `ஸ்ரீ பாப்பாபட்டி ஆச்சி ஒச்சாண்டம்மன் துணை`).
  - Contact numbers, framed shop title, customer name (`திரு:`), bill date (`தேதி:`), sequential Bill No.
  - 6-column table with vertical green borders, total row, previous balance, cash received, and closing balance.
  - Tamil footer `வாழ்க வளமுடன்`.
- **A4 / Thermal / Half-Sheet Support**:
  - Dedicated `@media print` CSS isolated from the application dashboard.
  - Clean page-break prevention (`page-break-inside: avoid`).
  - Zero content clipping, zero extra blank pages.

### Customer Management & Complete Ledger
- Full customer ledger timeline with chronological running balances.
- Standalone payment receipts (Cash, UPI/GPay, Bank Transfer, Cheque) with balance reduction without vegetable purchases.
- One-click customer balance reconciliation check against transaction history.

### Analytics & Reports
- **Daily Billing Report**: Day-wise bill count, total bags, total kg, total debit, cash collected.
- **Date-wise Sales Report**: Daily consolidated revenue summary.
- **Customer Outstanding Report**: Prioritized list of all customer credit balances.
- **Vegetable-wise Billing Report**: Total bags and kg sold and total revenue per vegetable.
- **Monthly Business Performance**: Month-by-month financial breakdown.
- **Export to CSV**: One-click download for accounting in Excel.

### Disaster Recovery & Long-term Data Safety
- One-click full database export (`/api/backup/export`) producing an offline JSON snapshot.
- One-click database restoration (`/api/backup/restore`) with schema validation.
- Audit log tracking for every bill creation, modification, cancellation, and payment.

---

## 3. Technology Stack

- **Backend**: Node.js, Express.js (v5), Mongoose (v9)
- **Database**: MongoDB (Local `cpn_vegetables_db` on port 27017)
- **Frontend**: React 19, Vite 6, Tailwind CSS v4, Lucide Icons
- **Security**: JWT Authentication, bcryptjs password hashing, helmet, CORS, sanitization
- **Precision**: Custom decimal-safe math utilities (`mathUtils.js`) preventing IEEE-754 floating-point errors

---

## 4. Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on port 27017 (`mongodb://127.0.0.1:27017`)

### Installation & Setup
```bash
# 1. Install dependencies
npm install

# 2. Build the production frontend
npm --prefix client run build

# 3. Start the production server
npm run server
```
Server runs on **http://localhost:5000** and serves both the API and the single-page application.

### Admin Provisioning CLI
To securely create or update an administrator account:
```bash
npm run seed-admin
```
Follow the interactive prompts to enter the admin username and password.

Alternatively, visit **http://localhost:5000/login** and click **"First time setup? Configure Initial Admin"**.

---

## 5. Automated Tests

Run the full automated test suite covering vegetable master, customer ledger, billing calculations, cash payments, void reversals, and decimal precision:
```bash
npm test
```

### Test Results
```
======================================================
  CPN VEGETABLES - COMPREHENSIVE AUTOMATED TEST SUITE  
======================================================

  [PASS] MongoDB connection established
  [PASS] Vegetable Master: created vegetable with normalized name
  [PASS] Vegetable Master: prevented duplicate vegetable name case-insensitively
  [PASS] Dynamic Billing: quick-added vegetable saved permanently in master
  [PASS] Customer Management: created customer with opening balance ₹5,000
  [PASS] Billing Calculation: verified Bag, Weight, Debit totals (3520.00)
  [PASS] Customer Accounting: accurate Closing Balance calculation (₹6,020.00)
  [PASS] Customer Accounting: customer current balance is loaded as next bill previous balance (₹6,020.00)
  [PASS] Bill #2: accurate balance continuity across sequential bills
  [PASS] Payment Management: standalone payment reduced customer balance to ₹4,020.00
  [PASS] Financial Arithmetic: strict decimal math verified (0.1 + 0.2 = 0.3)
  [PASS] Financial Arithmetic: precise multiplication verified (33.33 * 3 = 99.99)
  [PASS] Bill Cancellation: safely voided bill and verified balance consistency
  [PASS] Database Safety: verified all collections contain active records for backup

------------------------------------------------------
  TEST RESULTS: 14 PASSED, 0 FAILED
------------------------------------------------------
```

---

## 6. Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `F2` or `Alt + N` | Jump to **New Bill** page instantly |
| `Alt + B` | Jump to **All Bills** history |
| `Enter` | Advance to the next column / next row in billing table |
| `Ctrl + Enter` | Save newly created vegetable in quick-add modal |
| `Esc` | Close any open modal or clear search dropdown |

---

## 7. License & Credits

Built for **CPN VEGETABLES**, 22-A, Gandhi Market, Dindigul, Tamil Nadu.  
வாழ்க வளமுடன்.
