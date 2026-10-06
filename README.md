# Cal Ledger — Customer Accounts & Statement App

A mobile-first, daily bookkeeping and customer ledger web application engineered with strict financial discipline, clean day-mode aesthetics, and dual-layer data persistence (SQLite + browser localStorage).

---

## 🚀 Key Features

* **Direct Calculation Workspace:** Launches straight into the active customer's calculation screen; other accounts are kept private.
* **Private Customer Directory:** Off-canvas side drawer (`====`) for switching, adding, searching, and managing customer accounts.
* **Strict Financial Semantics:**
  * **DEBITED (−):** Deduction / Paid amounts.
  * **CREDITED (+):** Addition / Received amounts.
  * **Remaining Balance Formula:** $\text{Remaining} = \text{Old Balance} - \text{Debits} + \text{Credits}$.
* **In-Place Entry & Customer Editing:** Edit buttons on every transaction and customer header to easily correct spelling mistakes or amount mismatches in 1 tap.
* **Exact 3-Column Statement Slip:** 100% plain statement slip (Date, Description, Amount).
  * Automatically omits Old Balance row when ₹0 (only displays when $\ge$ ₹1).
  * 1-Click **High-Res Photo Slip (PNG)** generation via Canvas.
  * 1-Click pre-formatted **WhatsApp sharing**.
* **Manager's Private Archive ("Carry As Old"):** Move current balance to Old Balance while archiving past billing cycles into a manager-only history log.
* **Zero Dustbin / Minimalist Design:** Clean, discrete text actions without ugly trashcan icons.

---

## 📁 Project Structure

```
├── MAIN CAL/               # Frontend Application
│   ├── index.html          # Main HTML5 shell
│   ├── style.css           # Vanilla CSS3 Day-mode design system
│   ├── app.js              # State management & Canvas slip generator
│   ├── project cal.md      # Inch-by-inch architectural specification
│   ├── manifest.json       # PWA Manifest
│   └── app-icon.jpg        # App icon
├── python dev/             # Backend & SQLite Database
│   ├── server.py           # Python HTTP & REST API server
│   ├── accounts.db         # Persistent SQLite database
│   └── ledger.db           # SQLite database
├── RUN_APP.bat             # 1-Click Windows launcher
├── Procfile                # Cloud deployment configuration
├── render.yaml             # Render deployment configuration
└── requirements.txt        # Python dependencies
```

---

## 💻 How to Run Locally

### Windows (1-Click):
Double-click `RUN_APP.bat`. It starts the Python server and opens `http://localhost:8000` in your default browser.

### Command Line:
```bash
python "python dev/server.py"
```
* **PC Browser:** `http://localhost:8000`
* **Mobile Browser (Same Wi-Fi):** `http://<your-local-ip>:8000`
