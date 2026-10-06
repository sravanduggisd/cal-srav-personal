# CAL LEDGER — COMPLETE SYSTEM BLUEPRINT & DEVELOPMENT SPECIFICATION

> **Document Type:** Master Architectural & UI/UX Specification  
> **Target File:** `MAIN CAL/project cal.md`  
> **Project:** Cal Ledger (Daily Accounts, Balance Calculator & Statement Slip App)  
> **Status:** Fully Implemented & Documented (Single Source of Truth)  
> **Last Updated:** 2026-10-06  

---

## 1. Executive Summary & Core Philosophy

**Cal Ledger** is a mobile-first, daily bookkeeping and customer ledger web application engineered with strict financial discipline, clean day-mode aesthetics, and dual-layer data persistence (SQLite + browser localStorage).

### Core Design & Behavioral Principles:
1. **Direct Calculation on Launch:**
   - When the user launches the app, they land immediately on the active customer's **Calculation & Amount Entry Screen**.
   - Other customers are **completely hidden** to eliminate clutter and protect privacy during customer-facing interactions.
2. **Private Side Drawer (`====` / Hamburger):**
   - All customer accounts, searches, switching, deletions, and adding new customers live inside an off-canvas side drawer accessed via the `====` button on the top-left.
3. **Strict Financial Semantics:**
   - Transactions are strictly classified as **DEBITED (−)** (deductions, paid amounts) and **CREDITED (+)** (additions, receipts).
   - Balance formula:
     $$\text{Remaining Balance} = \text{Old Balance} - \text{Total Debits} + \text{Total Credits}$$
4. **Clean Aesthetics & "Zero Dustbin" Rule:**
   - The user requested a clean, professional aesthetic without distracting or ugly red trashcan/dustbin icons. Entry removals are managed with clean, discreet textual actions (`Remove`).
5. **Exact 3-Column Statement Slip (Reference Replica):**
   - Generates a 3-column statement matching paper/photo reference slips: **Date | Description | Amount**.
   - Provides 1-click **High-Resolution Photo Slip (PNG)** generation via HTML5 Canvas and formatted **WhatsApp sharing**.
6. **Manager's Private Archive ("Carry As Old"):**
   - At the end of a cycle, the manager can carry forward the balance. Previous entries are archived into a private manager-only ledger (`📜 Old Bal Entries`) while the customer statement resets to a clean, single "Old Balance" starting row.

---

## 2. Technology Stack & Architecture

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT (BROWSER)                     │
│  • HTML5 Semantic Shell                                │
│  • Vanilla CSS3 Design System (Mobile-First 480px)     │
│  • Pure ES6+ JavaScript (Zero external libraries)      │
│  • High-Res 2D Canvas Renderer (Photo Slip Export)     │
│  • LocalStorage Cache: CAL_LEDGER_DRAWER_DATA_V8       │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST API (Fetch)
                           │ GET /api/data  |  POST /api/save
┌──────────────────────────▼─────────────────────────────┐
│               PYTHON BACKEND SERVER                    │
│  • python dev/server.py (http.server + socketserver)   │
│  • Zero pip dependencies (Standard Library only)       │
│  • Serves static frontend from "MAIN CAL"              │
│  • Binds to PORT 8000 (Localhost + Wi-Fi LAN IP)       │
└──────────────────────────┬─────────────────────────────┘
                           │ Direct SQLite Driver
┌──────────────────────────▼─────────────────────────────┐
│                 SQLITE DATABASE                        │
│  • python dev/accounts.db (or ledger.db)               │
│  • Tables: customers, transactions                    │
│  • JSON Serialization for Manager History Archive      │
└────────────────────────────────────────────────────────┘
```

- **Frontend Tech:** HTML5, CSS3, Vanilla JavaScript (ES6+). No frameworks, no external CSS libraries, instant 0ms load.
- **Backend Tech:** Python 3 standard library `http.server`, `sqlite3`, `socketserver`. Runs out of the box on Windows/Mac/Linux.
- **Execution Scripts:** `RUN_APP.bat` for instant 1-click local launch on Windows; `Procfile` and `render.yaml` for cloud deployment.
- **Dual Persistence:**
  - Online/Desktop: Automatically syncs state changes via `POST /api/save` to SQLite database.
  - Offline/Standalone: Automatically caches state in `localStorage` under key `CAL_LEDGER_DRAWER_DATA_V8`.

---

## 3. Inch-by-Inch UI Component Breakdown

### 3.1. Base Viewport & Shell Layout
- **Body Styling (`body.day-mode`):**
  - Background: Slate gray `#e2e8f0` on desktop; centers mobile phone frame.
  - Typography: Primary font `'Plus Jakarta Sans'`, Monospace `'JetBrains Mono'`.
- **App Container (`.app-container`):**
  - Maximum width: `480px`.
  - Full viewport height: `min-height: 100vh`.
  - Background: Clean white/slate `#f4f6fa`.
  - Elevation: Soft diffuse shadow `0 0 25px rgba(0,0,0,0.10)`.

---

### 3.2. Side Navigation Drawer (`#sideDrawer` & `#drawerOverlay`)
Accessible by clicking the `====` hamburger button or tapping the active customer title box.

| Component | Selector / ID | Description & Behavior |
| :--- | :--- | :--- |
| **Backdrop Overlay** | `#drawerOverlay` | Semi-transparent dark overlay (`rgba(15, 23, 42, 0.5)`). Tapping closes drawer. |
| **Drawer Header** | `.drawer-header` | Displays `👥 ALL CUSTOMERS` with subtitle "Private Directory" and close `✕` button (`#closeDrawerBtn`). |
| **Add Customer Button** | `#openAddCustomerDrawerBtn` | Prominent full-width blue button: `+ ADD NEW CUSTOMER`. Opens Add Customer Modal. |
| **Search Input** | `#drawerCustomerSearch` | Real-time text search input with 🔍 icon. Dynamically filters customers by name. |
| **Customer Cards List** | `#drawerCustomersList` | Scrollable container rendering customer cards. Each card displays: Customer name, Remaining balance (green/red), Old balance amount & date, entry count, `Select` button, and `Delete` button. |
| **Drawer Footer** | `.drawer-footer` | Contains: `Clear All App Data` (red outline) and `Load Sample Demo` (subtle gray). |

---

### 3.3. Main Screen 1: Calculation & Amount Entry (`#pageCalculation`)
The primary active screen on app launch.

#### A. Header Bar (`.calc-screen-header`)
- **Hamburger Button (`#openMenuDrawerBtn`):**
  - Displays three horizontal blue bars (`====`).
  - Triggers the Customer Directory Side Drawer.
- **Active Customer Box (`#activeCustHeaderBox`):**
  - Shows top badge `ACTIVE ACCOUNT`.
  - Displays the active customer's name (`#activeCustomerTitle`).
  - Interactive: Tapping switches customer via side drawer.
- **Right Action Buttons:**
  - `📄 Statement` (`#goToStatementBtn`): Switches to Screen 2 (Statement Slip).
  - `🧮` (`#calcOpenBtn`): Opens floating quick arithmetic calculator popup.

#### B. Top Remaining Balance Display (`.customer-balance-box`)
- **Section Label:** `REMAINING BALANCE` in tracking uppercase.
- **Digits Display (`#activeRemainingBalance`):**
  - Huge bold numbers with `₹` prefix.
  - Color dynamically set to Emerald Green (`#059669`) if $\ge 0$, or Red (`#dc2626`) if negative.
- **3 Breakdown Pills (`.cust-breakdown-row`):**
  1. **Old Balance Pill (`#pillOldBalBox`):**
     - Background: Soft Blue `#eaf2ff`.
     - Value: Strict bold black `#000000` text (`activeOldBalanceVal`).
     - Interactive: Tapping opens the private Old Balance Past Entries Archive.
  2. **Debited Pill (`.pill-paid`):**
     - Background: Soft Pink `#fdeeed`.
     - Value: Red text `-₹...` (`activeDebitedVal`).
  3. **Credited Pill (`.pill-credit`):**
     - Background: Soft Mint `#e8f8ed`.
     - Value: Green text `+₹...` (`activeCreditedVal`).
- **Action Sub-Bar (`.customer-action-subbar`):**
  - Shows `Old Bal Date: [Date]` (`#activeOldBalDateLabel`).
  - `✏️ Edit Old Bal` (`#btnEditOldBal`): Opens modal to modify starting balance/date.
  - `📜 Old Bal Entries ([Count])` (`#btnViewOldHistory`): Opens the manager's archived cycles modal.
  - `🔄 Carry As Old` (`#btnCarryForward`): Archives all current entries and sets new Old Balance to current Remaining Balance.

#### C. Daily Calculation Entries Feed (`.tx-feed-wrapper`)
- **Feed Header (`.tx-feed-header`):**
  - Title: `DAILY CALCULATION ENTRIES`.
  - Sort Toggle Button (`#sortOrderToggleBtn`): Toggles between `⬇️ First Added Top` (default) and `⬆️ Latest on Top`.
  - Badge (`#txCountBadge`): Displays total count of active entries.
- **List Container (`#activeTxFeedList`):**
  - Individual Entry Cards (`.tx-item-card`):
    - Left side: Circular type icon pill (`−` red for debit, `+` green for credit).
    - Details: Description title and Date string.
    - Right side: Amount formatted with `-₹` or `+₹`.
    - Action Group (`.tx-item-actions`): Text buttons `Edit` (`openEditEntryModal(id)`) and `Remove` (`removeActiveEntryPlain(id)`) — allows fixing spelling mistakes or amount mismatches effortlessly, with zero trashcan icons!

#### D. Bottom Dual Action Bar (`.dual-action-bottom-bar`)
- Fixed at the bottom of the calculation screen with two equal large touch targets:
  1. **Red Button (Left): `DEBITED (−)`**
     - Sign: Large `−` icon.
     - Subtitle: `(DEDUCTION / PAID)`.
     - Triggers Add Entry Modal pre-selected with `DEBIT`.
  2. **Green Button (Right): `CREDITED (+)`**
     - Sign: Large `+` icon.
     - Subtitle: `(ADDITION / RECEIVED)`.
     - Triggers Add Entry Modal pre-selected with `CREDIT`.

---

### 3.4. Main Screen 2: Dedicated Statement Slip (`#pageStatementSlip`)
A clean, printable, photogenic statement matching the user's reference slip.

#### A. Header
- Back button `←` (`#backToCalcBtn`) returning to calculation screen.
- Title: `[Customer Name] - Statement`.

#### B. Reference 3-Column Table (`.slip-reference-table` & `#statementSlipContainer`)
- **Table Columns:**
  1. **Date** (`.col-date`, width ~25%)
  2. **Description** (`.col-desc`, width ~48%)
  3. **Amount** (`.col-amt`, width ~27%)
- **Rows Structure:**
  - **Header Row:** Royal Blue background (`#0b4d99`), bold white text.
  - **Row 1 — Old Balance (Smart Zero-Omission):**
    - **Zero Rule:** If Old Balance is ₹0, the Old Balance row is **completely omitted** from the statement table, canvas PNG export, and WhatsApp message.
    - **Display Threshold:** Only presented if Old Balance is at least ₹1 (`Math.abs(calc.oldBal) >= 1`).
    - Soft blue background (`#eaf2ff`), bold green amount.
  - **Middle Rows — Entries:**
    - Debits: Soft pink background (`#fdeeed`), red amount `-₹...`.
    - Credits: Soft green background (`#f0fdf4`), green amount `+₹...`.
  - **Final Row — Remaining Balance:** Soft mint background (`#e8f8ed`), bold green amount `₹...`.
  - **Borders:** Crisp clean solid borders (`#1e293b`), zero distracting symbols.

#### C. Slip Export Actions (`.statement-bottom-buttons`)
- **`📸 DOWNLOAD PHOTO SLIP (PNG)` (`#btnDownloadStatementPhoto`):**
  - Renders the exact table into a hidden $2\times$ high-resolution Canvas (`#photoExportCanvas`).
  - Omits Old Balance row automatically when ₹0, adapting total row height and grid borders dynamically.
  - Exports crisp PNG file named `[Customer_Name]_Statement_[Timestamp].png`.
- **`💬 SHARE ON WHATSAPP` (`#btnShareStatementWhatsApp`):**
  - Builds formatted WhatsApp message string with customer name, itemized list, and remaining balance (omitting Old Balance line if ₹0). Opens `https://wa.me/?text=...`.

---

### 3.5. Modals & Dialogs

#### 1. Add New Customer Modal (`#addCustomerModal`)
- Fields:
  - `Customer / Person Name*` (text, required)
  - `Phone Number` (tel, optional)
  - `Starting / Old Balance (₹)` (number, default 0)
  - `Old Balance Date` (text, e.g. "30th Sep")
- Actions: `Cancel` and `Save & Open Ledger`.

#### 2. Edit Customer Details Modal (`#editCustomerModal`)
- Triggered by: `✏️` button next to Active Account title or `Edit` button in Drawer cards.
- Fields:
  - `Customer / Person Name*` (editable for spelling corrections)
  - `Phone Number` (optional)
- Actions: `Cancel` and `Update Customer`.

#### 3. Record / Edit Entry Modal (`#addEntryModal`)
- Modes:
  - **Record Entry:** Pre-selected blank amount and defaults.
  - **Edit Entry (`openEditEntryModal(id)`):** Pre-fills existing amount, date, description, and debit/credit tab so typos or amount mismatches can be fixed in 1 tap.
- Segmented Choice Tabs:
  - `🔴 DEBITED (−)`
  - `🟢 CREDITED (+)`
- Fields:
  - `Amount (₹)*` (large prominent numeric input with `₹` prefix)
  - `Date*` (text, defaults to formatted date e.g., "6th Oct")
  - `Description / Note*` (text input)
  - **Quick Preset Chips:** One-tap chips to populate description:
    `[Paid]` `[Interest Money]` `[Account Transfer]` `[Advance]`
- Actions: `Cancel` and `Save Entry` (or `Update Entry`).

#### 4. Edit Old Balance Modal (`#editOldBalModal`)
- Fields:
  - `Old Balance Amount (₹)*`
  - `Old Balance Date Label*`
- Actions: `Cancel` and `Update Old Balance`.

#### 4. Old Balance Past Entries Archive (`#oldHistoryModal`)
- Purpose: Private manager-only archive showing every past billing cycle carried forward.
- Content:
  - Cycle badge: `CYCLE #N`.
  - Carried Date, Old Balance Before, Final Carried Balance.
  - Full itemized entry list from that cycle.
  - Cycle totals: Total Debited, Total Credited.
  - Action to delete individual cycle or `🗑️ Delete All Past Records`.

#### 5. Quick Calculator Popup (`#calcPopup`)
- Overlay arithmetic pad:
  - Display showing mathematical expression and evaluated result.
  - Keypad buttons: `C`, `⌫`, `%`, `÷`, numbers `0-9`, `00`, `.`, `×`, `−`, `+`, `=`.

---

## 4. Data Models & Schemas

### 4.1. Customer Entity
```json
{
  "id": "cust_1728200000000",
  "name": "P. Lakshmi Kumar",
  "phone": "9876543210",
  "oldBalance": 641000.0,
  "oldBalanceDate": "27th Sep",
  "history": [
    {
      "id": "cycle_1728100000000",
      "carriedDate": "30th Sep",
      "oldBalanceBefore": 500000.0,
      "totalDebits": 100000.0,
      "totalCredits": 241000.0,
      "finalRemaining": 641000.0,
      "entries": [
        {
          "id": "e_past_1",
          "date": "28th Sep",
          "description": "Previous payment",
          "type": "CREDIT",
          "amount": 241000.0
        }
      ]
    }
  ],
  "entries": [
    {
      "id": "entry_1728200100000",
      "date": "30th Sep",
      "description": "P. Lakshmi Kumar Paid",
      "type": "DEBIT",
      "amount": 200000.0
    }
  ]
}
```

### 4.2. Transaction Entry Entity
```json
{
  "id": "entry_1728200100000",
  "date": "30th Sep",
  "description": "Paid",
  "type": "DEBIT",  // "DEBIT" or "CREDIT"
  "amount": 200000.0
}
```

### 4.3. AppState Object
```javascript
let AppState = {
  activeCustomerId: "cust_1728200000000",
  customers: [...],
  sortOrder: "first_top" // "first_top" (default) or "latest_top"
};
```

---

## 5. Backend REST API & Database Schema

### 5.1. SQLite Tables (`python dev/accounts.db` & `ledger.db`)
```sql
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    old_balance REAL DEFAULT 0,
    old_balance_date TEXT,
    history TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
);
```

### 5.2. API Endpoints
- **`GET /api/data`**
  - Fetches all customers, parses `history` JSON, fetches nested `transactions`, returns `{ "customers": [...] }`.
- **`POST /api/save`**
  - Accepts `{ "customers": [...] }`.
  - Executes atomic transaction: wipes existing records and bulk-inserts updated customer state and transactions.
  - Returns `{ "status": "success", "count": N }`.

---

## 6. Color Tokens & Visual System Reference

| Token Name | Hex Code | Usage |
| :--- | :--- | :--- |
| `--brand-blue` | `#0b4d99` | Primary header bars, active buttons, table header |
| `--brand-blue-hover` | `#083c78` | Hover/active states on primary buttons |
| `--color-green` | `#059669` | Credited (+) pills, credited entry badges |
| `--color-green-light`| `#e8f8ed` | Credited table row background, remaining balance pill |
| `--color-red` | `#dc2626` | Debited (−) pills, debited entry badges |
| `--color-red-light` | `#fdeeed` | Debited table row background |
| `--color-black` | `#000000` | Strict Old Balance text color in pills |
| `--ref-old-bal-bg` | `#eaf2ff` | Statement table Old Balance row background |
| `--ref-border` | `#1e293b` | Statement table border grid |
| `--bg-app` | `#f4f6fa` | App container background |
| `--bg-card` | `#ffffff` | Feed item cards, dialog backgrounds |

---

## 7. Guidelines for Any Future Developments

Whenever any new features, adjustments, or enhancements are requested by the user, adhere strictly to these rules:

1. **Preserve the Direct Calculation Landing:** Never replace the direct calculation landing with a customer selector page on initial load. The customer directory **must stay inside the side drawer (`====`)**.
2. **Preserve Credited / Debited Semantics:** Do not rename or confuse `DEBITED (−)` (money out/paid) and `CREDITED (+)` (money in/received).
3. **Preserve Clean Minimalist Aesthetics:** No trashcan/dustbin icons in the daily entries list.
4. **Preserve Old Balance History Architecture:** Any balance reset or carry-forward must preserve the manager's private history archive in `cust.history` while keeping the customer statement slip table clean.
5. **Maintain Dual Persistence:** Any new field added to a customer or transaction must be saved both in `localStorage` and synchronized with the Python SQLite schema.
6. **Update This Blueprint First:** Whenever new features are introduced, update this `project cal.md` document to ensure continuous alignment.
