/**
 * CAL LEDGER - Mobile-First Ledger with Private Customer Drawer (====)
 * - Opens directly to the Calculation & Amount Entry screen on launch.
 * - Other customers are completely HIDDEN inside the Side Navigation Drawer (====).
 * - Full SQLite database synchronization with Python backend (python dev/ledger.db).
 * - 100% plain statement slip matching user's reference image (Zero dustbins).
 * - Strictly uses CREDITED (+) & DEBITED (−).
 */

const STORAGE_KEY = "CAL_LEDGER_DRAWER_DATA_V8";

// Unregister old service workers and purge browser cache
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) registration.unregister();
  });
}
if ("caches" in window) {
  caches.keys().then(names => {
    for (let name of names) caches.delete(name);
  });
}

let AppState = {
  activeCustomerId: null,
  customers: [],
  sortOrder: "first_top" // "first_top" (default: first added entry at top) or "latest_top" (newest on top)
};

// Reference Demo Data
const REFERENCE_DEMO_DATA = [
  {
    id: "demo_1",
    name: "P. Lakshmi Kumar",
    phone: "9876543210",
    oldBalance: 641000,
    oldBalanceDate: "27th Sep",
    entries: [
      {
        id: "e_1",
        date: "30th Sep",
        description: "P. Lakshmi Kumar Paid",
        type: "DEBIT",
        amount: 200000
      }
    ]
  },
  {
    id: "demo_2",
    name: "Dhana Account",
    phone: "",
    oldBalance: 441000,
    oldBalanceDate: "30th Sep",
    entries: [
      {
        id: "e_2",
        date: "30th Sep",
        description: "Dhana Account → P. Lakshmi Kumar",
        type: "DEBIT",
        amount: 180000
      },
      {
        id: "e_3",
        date: "30th Sep",
        description: "Dhana Interest Money",
        type: "DEBIT",
        amount: 50000
      }
    ]
  }
];

// Helper: Format Currency
function formatCurrency(num) {
  const val = Math.abs(parseFloat(num) || 0);
  return val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function getTodayText() {
  const d = new Date();
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[d.getMonth()];
  
  let suffix = "th";
  if (day === 1 || day === 21 || day === 31) suffix = "st";
  else if (day === 2 || day === 22) suffix = "nd";
  else if (day === 3 || day === 23) suffix = "rd";

  return `${day}${suffix} ${m}`;
}

// Storage Management & Python SQLite Backend Sync
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      AppState.customers = parsed.customers || [];
      AppState.activeCustomerId = parsed.activeCustomerId || null;
      AppState.sortOrder = parsed.sortOrder || "first_top";
    } catch (e) {
      console.error(e);
    }
  }

  // Also attempt to load from Python SQLite backend if running
  fetch("/api/data", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      if (data && data.customers && data.customers.length > 0) {
        AppState.customers = data.customers;
        if (!AppState.activeCustomerId || !AppState.customers.some(c => c.id === AppState.activeCustomerId)) {
          AppState.activeCustomerId = AppState.customers[0].id;
        }
        saveState(false); // save locally without sending loop back
        renderAll();
      }
    })
    .catch(() => {
      // Python server not running or standalone mode, perfectly fine
    });

  // Ensure active customer exists
  ensureActiveCustomer();
}

function saveState(syncToBackend = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activeCustomerId: AppState.activeCustomerId,
    customers: AppState.customers,
    sortOrder: AppState.sortOrder || "first_top"
  }));

  // Sync to Python SQLite backend
  if (syncToBackend) {
    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customers: AppState.customers })
    }).catch(() => {});
  }
}

function ensureActiveCustomer() {
  if (AppState.customers.length > 0) {
    if (!AppState.activeCustomerId || !AppState.customers.some(c => c.id === AppState.activeCustomerId)) {
      AppState.activeCustomerId = AppState.customers[0].id;
    }
  } else {
    // Create an initial default ledger account if totally empty
    const defaultCust = {
      id: "cust_default",
      name: "Cash Account",
      phone: "",
      oldBalance: 0,
      oldBalanceDate: getTodayText(),
      entries: []
    };
    AppState.customers = [defaultCust];
    AppState.activeCustomerId = defaultCust.id;
    saveState();
  }
}

function getActiveCustomer() {
  return AppState.customers.find(c => c.id === AppState.activeCustomerId) || AppState.customers[0];
}

// Balance Calculation
function calculateCustomer(cust) {
  if (!cust) return { oldBal: 0, totalDebits: 0, totalCredits: 0, remaining: 0, lastDate: "" };

  const oldBal = parseFloat(cust.oldBalance) || 0;
  let totalDebits = 0;
  let totalCredits = 0;
  let lastDate = cust.oldBalanceDate || "";

  (cust.entries || []).forEach(e => {
    const amt = parseFloat(e.amount) || 0;
    if (e.type === "DEBIT") totalDebits += amt;
    else totalCredits += amt;
    if (e.date) lastDate = e.date;
  });

  const remaining = oldBal - totalDebits + totalCredits;

  return { oldBal, totalDebits, totalCredits, remaining, lastDate };
}

// =========================================================
// SIDE NAVIGATION DRAWER (ALL CUSTOMERS DIRECTORY)
// =========================================================

function openSideDrawer() {
  renderDrawerCustomersList();
  document.getElementById("sideDrawer").classList.add("active");
  document.getElementById("drawerOverlay").classList.add("active");
}

function closeSideDrawer() {
  document.getElementById("sideDrawer").classList.remove("active");
  document.getElementById("drawerOverlay").classList.remove("active");
}

function renderDrawerCustomersList() {
  const container = document.getElementById("drawerCustomersList");
  const query = (document.getElementById("drawerCustomerSearch").value || "").toLowerCase().trim();

  let list = AppState.customers;
  if (query) {
    list = list.filter(c => c.name.toLowerCase().includes(query));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 25px 10px; color: #64748b; font-size: 0.8rem;">
        No customers found. Tap "ADD NEW CUSTOMER" above.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(c => {
    const calc = calculateCustomer(c);
    const isPositive = calc.remaining >= 0;
    const isActive = c.id === AppState.activeCustomerId;
    const statusClass = isPositive ? "positive" : "negative";

    return `
      <div class="drawer-cust-card ${isActive ? "active-cust" : ""}" onclick="selectCustomerFromDrawer('${c.id}')">
        <div class="dcc-top">
          <div class="dcc-name">👤 ${escapeHtml(c.name)}</div>
          <div class="dcc-bal ${statusClass}">₹${formatCurrency(calc.remaining)}</div>
        </div>
        <div class="dcc-sub">
          Old: ₹${formatCurrency(calc.oldBal)} (${c.oldBalanceDate || "Set"}) • ${(c.entries || []).length} entries
        </div>
        <div class="dcc-actions" onclick="event.stopPropagation()">
          <button class="btn-dcc-select" onclick="selectCustomerFromDrawer('${c.id}')">Select</button>
          <button class="btn-dcc-edit" onclick="openEditCustomerModal('${c.id}')">Edit</button>
          <button class="btn-dcc-delete" onclick="deleteCustomerFromDrawer('${c.id}', '${escapeHtml(c.name)}')">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

window.selectCustomerFromDrawer = function(custId) {
  AppState.activeCustomerId = custId;
  saveState();
  closeSideDrawer();
  renderCalculationScreen();
};

window.deleteCustomerFromDrawer = function(custId, custName) {
  if (confirm(`Permanently delete "${custName}" and all their records?`)) {
    AppState.customers = AppState.customers.filter(c => c.id !== custId);
    ensureActiveCustomer();
    saveState();
    renderDrawerCustomersList();
    renderCalculationScreen();
    alert(`"${custName}" deleted.`);
  }
};

// =========================================================
// SCREEN 1: CALCULATION & ENTRY SCREEN (MAIN VIEW)
// =========================================================

function renderCalculationScreen() {
  const cust = getActiveCustomer();
  if (!cust) return;

  const calc = calculateCustomer(cust);

  // Header Title
  document.getElementById("activeCustomerTitle").textContent = cust.name;

  // Remaining Balance (Green if positive, Red if negative)
  const remDisplay = document.getElementById("activeRemainingBalance");
  remDisplay.textContent = formatCurrency(calc.remaining);
  remDisplay.className = calc.remaining >= 0 ? "cust-bal-digits" : "cust-bal-digits negative";

  // 3 Breakdown Pills
  document.getElementById("activeOldBalanceVal").textContent = `₹${formatCurrency(calc.oldBal)}`;
  document.getElementById("activeDebitedVal").textContent = `-₹${formatCurrency(calc.totalDebits)}`;
  document.getElementById("activeCreditedVal").textContent = `+₹${formatCurrency(calc.totalCredits)}`;
  document.getElementById("activeOldBalDateLabel").textContent = `Old Bal Date: ${cust.oldBalanceDate || "Not Set"}`;

  // Update Old Balance History Badge Count
  const histBadge = document.getElementById("oldHistoryCountBadge");
  if (histBadge) {
    histBadge.textContent = (cust.history || []).length;
  }

  // Transactions Feed (Plain, Clean, No Dustbin icons)
  const feed = document.getElementById("activeTxFeedList");
  const countBadge = document.getElementById("txCountBadge");
  const entries = cust.entries || [];
  countBadge.textContent = `${entries.length} Entries`;

  // Update Sort Button Label and Icon
  const sortIcon = document.getElementById("sortOrderIcon");
  const sortLabel = document.getElementById("sortOrderLabel");
  const isFirstTop = (AppState.sortOrder !== "latest_top");

  if (sortIcon && sortLabel) {
    if (isFirstTop) {
      sortIcon.textContent = "⬇️";
      sortLabel.textContent = "First Added Top";
    } else {
      sortIcon.textContent = "⬆️";
      sortLabel.textContent = "Latest on Top";
    }
  }

  if (entries.length === 0) {
    feed.innerHTML = `
      <div style="text-align:center; padding: 30px 14px; color: #94a3b8; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 0.9rem; font-weight: 800; color: #334155;">No entries recorded yet</div>
        <div style="font-size: 0.72rem; margin-top: 4px; color: #64748b;">Tap <strong>DEBITED (−)</strong> or <strong>CREDITED (+)</strong> below to add.</div>
      </div>
    `;
    return;
  }

  // Whatever added first is at top by default, or latest at top if toggled
  const displayEntries = isFirstTop ? [...entries] : [...entries].reverse();

  feed.innerHTML = displayEntries.map(e => {
    const isDebit = e.type === "DEBIT";
    const icon = isDebit ? "−" : "+";
    const typeClass = isDebit ? "debit" : "credit";
    const sign = isDebit ? "-₹" : "+₹";

    return `
      <div class="tx-item-card">
        <div class="tx-item-left">
          <div class="tx-icon-pill ${typeClass}">${icon}</div>
          <div>
            <div class="tx-item-desc">${escapeHtml(e.description)}</div>
            <div class="tx-item-date">${escapeHtml(e.date || "")}</div>
          </div>
        </div>
        <div class="tx-item-right">
          <div class="tx-item-amt ${typeClass}">${sign}${formatCurrency(e.amount)}</div>
          <div class="tx-item-actions">
            <button class="tx-plain-edit-btn" onclick="openEditEntryModal('${e.id}')">Edit</button>
            <span class="tx-action-sep">•</span>
            <button class="tx-plain-remove-btn" onclick="removeActiveEntryPlain('${e.id}')">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

window.toggleSortOrder = function(e) {
  if (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }
  AppState.sortOrder = (AppState.sortOrder === "latest_top") ? "first_top" : "latest_top";
  saveState(false);
  renderCalculationScreen();
};

window.removeActiveEntryPlain = function(entryId) {
  const cust = getActiveCustomer();
  if (!cust) return;

  if (confirm("Remove this entry?")) {
    cust.entries = (cust.entries || []).filter(e => e.id !== entryId);
    saveState();
    renderCalculationScreen();
  }
};

// Carry Forward (Archives past entries into private Old Balance History)
function carryForwardActiveCustomer() {
  const cust = getActiveCustomer();
  if (!cust) return;

  const calc = calculateCustomer(cust);
  const entriesCount = (cust.entries || []).length;

  if (entriesCount === 0) {
    alert("No daily entries to carry forward. Old balance is already current.");
    return;
  }

  const msg = `Carry forward calculation for ${cust.name}?\n\n• New Starting Old Balance: ₹${formatCurrency(calc.remaining)}\n• Date: ${getTodayText()}\n\nAll ${entriesCount} daily entries will be archived into your private "Old Bal Entries" history and cleared for the new cycle.\n(Note: The customer statement slip will only show the clean new Old Balance).`;

  if (confirm(msg)) {
    if (!cust.history) cust.history = [];
    cust.history.unshift({
      id: "cycle_" + Date.now(),
      carriedDate: getTodayText(),
      oldBalanceBefore: calc.oldBal,
      totalDebits: calc.totalDebits,
      totalCredits: calc.totalCredits,
      finalRemaining: calc.remaining,
      entries: JSON.parse(JSON.stringify(cust.entries || []))
    });

    cust.oldBalance = calc.remaining;
    cust.oldBalanceDate = getTodayText();
    cust.entries = [];
    saveState();
    renderCalculationScreen();
    alert(`Success! ${cust.name}'s new Old Balance is ₹${formatCurrency(cust.oldBalance)}.\n\nAll previous entries have been safely saved to "📜 Old Bal Entries" for the shop manager.`);
  }
}

// =========================================================
// OLD BALANCE PAST ENTRIES MODAL (MANAGER PRIVATE ARCHIVE)
// =========================================================

window.openOldHistoryModal = function() {
  const cust = getActiveCustomer();
  if (!cust) return;

  renderOldHistoryContent();
  document.getElementById("oldHistoryModal").classList.add("active");
};

window.closeOldHistoryModal = function() {
  document.getElementById("oldHistoryModal").classList.remove("active");
};

function renderOldHistoryContent() {
  const cust = getActiveCustomer();
  const container = document.getElementById("oldHistoryContent");
  if (!cust || !container) return;

  const history = cust.history || [];
  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-history-box">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">📂</div>
        <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem;">No Archived Old Balance Entries</div>
        <div style="color: #64748b; font-size: 0.75rem; margin-top: 6px; line-height: 1.5;">
          When you tap <strong>"🔄 Carry As Old"</strong> on the main screen, the entries are automatically archived right here so the manager can review them anytime, while keeping customer statement slips clean and simple!
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map((cycle, cIndex) => {
    return `
      <div class="archived-cycle-card">
        <div class="acc-header">
          <div class="acc-header-left">
            <span class="acc-badge">CYCLE #${history.length - cIndex}</span>
            <span class="acc-date">Carried: <strong>${escapeHtml(cycle.carriedDate)}</strong></span>
          </div>
          <div class="acc-bal-summary">
            <span class="acc-old-tag">Old: ₹${formatCurrency(cycle.oldBalanceBefore)}</span>
            <span class="acc-new-tag">Carried: ₹${formatCurrency(cycle.finalRemaining)}</span>
          </div>
        </div>

        <div class="acc-entries-table">
          ${(cycle.entries || []).map(e => {
            const isDebit = e.type === "DEBIT";
            const rowClass = isDebit ? "acc-debit" : "acc-credit";
            const sign = isDebit ? "-₹" : "+₹";
            return `
              <div class="acc-entry-row ${rowClass}">
                <div class="acc-row-left">
                  <span class="acc-row-date">${escapeHtml(e.date || "")}</span>
                  <span class="acc-row-desc">${escapeHtml(e.description)}</span>
                </div>
                <div class="acc-row-amt">${sign}${formatCurrency(e.amount)}</div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="acc-cycle-footer">
          <div class="acc-totals">
            <span class="acc-deb-total">Debited: -₹${formatCurrency(cycle.totalDebits)}</span>
            <span class="acc-cred-total">Credited: +₹${formatCurrency(cycle.totalCredits)}</span>
          </div>
          <button type="button" class="btn-cycle-delete" onclick="deleteHistoryCycle('${cycle.id}')">🗑️ Delete Record</button>
        </div>
      </div>
    `;
  }).join("");
}

window.deleteHistoryCycle = function(cycleId) {
  const cust = getActiveCustomer();
  if (!cust) return;

  if (confirm("Permanently delete this archived past cycle record?")) {
    cust.history = (cust.history || []).filter(c => c.id !== cycleId);
    saveState();
    renderOldHistoryContent();
    renderCalculationScreen();
  }
};

window.clearAllOldHistory = function() {
  const cust = getActiveCustomer();
  if (!cust) return;

  if (!cust.history || cust.history.length === 0) {
    alert("No past history records to delete.");
    return;
  }

  if (confirm(`Permanently delete all archived past records for ${cust.name}?`)) {
    cust.history = [];
    saveState();
    renderOldHistoryContent();
    renderCalculationScreen();
    alert("All past archived records deleted.");
  }
};

// =========================================================
// SCREEN 2: DEDICATED STATEMENT SLIP (100% Plain, Zero Dustbins)
// =========================================================

function showStatementSlipScreen() {
  const cust = getActiveCustomer();
  if (!cust) return;

  const calc = calculateCustomer(cust);
  document.getElementById("statementSlipCustomerTitle").textContent = `${cust.name} - Statement`;

  const tbody = document.getElementById("statementSlipTableBody");
  const rows = [];

  // Row 1: Old Balance (Soft Blue #eaf2ff) - 100% Plain
  // Requirement: If Old Balance is 0, do not present Old Balance row. Only show if at least ₹1.
  if (Math.abs(calc.oldBal) >= 1) {
    rows.push(`
      <tr class="row-old-balance">
        <td class="cell-date">${escapeHtml(cust.oldBalanceDate || "Old")}</td>
        <td class="cell-desc">Old Balance</td>
        <td class="cell-amt">₹${formatCurrency(calc.oldBal)}</td>
      </tr>
    `);
  }

  // Middle Rows: Debited (Soft Pink #fdeeed) or Credited (Soft Green #f0fdf4) - 100% Plain
  (cust.entries || []).forEach(e => {
    const isDebit = e.type === "DEBIT";
    const rowClass = isDebit ? "row-debit" : "row-credit";
    const sign = isDebit ? "-₹" : "+₹";

    rows.push(`
      <tr class="${rowClass}">
        <td class="cell-date">${escapeHtml(e.date || "")}</td>
        <td class="cell-desc">${escapeHtml(e.description)}</td>
        <td class="cell-amt">${sign}${formatCurrency(e.amount)}</td>
      </tr>
    `);
  });

  // Bottom Row: Remaining Balance (Soft Mint Green #e8f8ed) - 100% Plain
  const remDate = calc.lastDate || cust.oldBalanceDate || getTodayText();
  rows.push(`
    <tr class="row-remaining">
      <td class="cell-date">${escapeHtml(remDate)}</td>
      <td class="cell-desc">Remaining Balance</td>
      <td class="cell-amt">₹${formatCurrency(calc.remaining)}</td>
    </tr>
  `);

  tbody.innerHTML = rows.join("");

  document.getElementById("pageCalculation").classList.remove("active");
  document.getElementById("pageStatementSlip").classList.add("active");
  window.scrollTo(0, 0);
}

function backToCalculationScreen() {
  document.getElementById("pageStatementSlip").classList.remove("active");
  document.getElementById("pageCalculation").classList.add("active");
  window.scrollTo(0, 0);
  renderCalculationScreen();
}

/**
 * EXACT PHOTO SLIP GENERATOR (PIXEL-PERFECT CANVAS, ZERO DUSTBINS)
 */
function generatePhotoSlipImage(callback) {
  const cust = getActiveCustomer();
  if (!cust) return;

  const calc = calculateCustomer(cust);
  const canvas = document.getElementById("photoExportCanvas");
  const ctx = canvas.getContext("2d");

  const hasOldBal = Math.abs(calc.oldBal) >= 1;
  const entriesCount = (cust.entries || []).length;
  const totalRows = (hasOldBal ? 1 : 0) + entriesCount + 1; // +1 for remaining balance
  const baseWidth = 1024;
  const headerHeight = 110;
  const rowHeight = 115;
  const baseHeight = headerHeight + totalRows * rowHeight;

  const scale = 2;
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  const col1W = 260; // Date
  const col2W = 460; // Description
  const col3W = 304; // Amount

  const x0 = 0;
  const x1 = col1W;
  const x2 = col1W + col2W;

  // 1. Header (Royal Blue #0b4d99)
  ctx.fillStyle = "#0b4d99";
  ctx.fillRect(0, 0, baseWidth, headerHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("Date", x0 + col1W / 2, headerHeight / 2);
  ctx.fillText("Description", x1 + col2W / 2, headerHeight / 2);
  ctx.fillText("Amount", x2 + col3W / 2, headerHeight / 2);

  let currentY = headerHeight;

  // 2. Old Balance (Soft Blue #eaf2ff) - ONLY render if at least ₹1
  if (hasOldBal) {
    ctx.fillStyle = "#eaf2ff";
    ctx.fillRect(0, currentY, baseWidth, rowHeight);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 38px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cust.oldBalanceDate || "Old", x0 + col1W / 2, currentY + rowHeight / 2);

    ctx.textAlign = "left";
    ctx.fillText("Old Balance", x1 + 35, currentY + rowHeight / 2);

    ctx.fillStyle = "#006400";
    ctx.font = "bold 42px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`₹${formatCurrency(calc.oldBal)}`, x2 + col3W / 2, currentY + rowHeight / 2);

    currentY += rowHeight;
  }

  // 3. Middle Rows: Debited (Soft Pink #fdeeed) or Credited (Soft Green #f0fdf4)
  (cust.entries || []).forEach(e => {
    const isDebit = e.type === "DEBIT";

    ctx.fillStyle = isDebit ? "#fdeeed" : "#f0fdf4";
    ctx.fillRect(0, currentY, baseWidth, rowHeight);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 38px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(e.date || "", x0 + col1W / 2, currentY + rowHeight / 2);

    ctx.textAlign = "left";
    const desc = e.description || "";
    if (desc.length > 25) {
      ctx.font = "bold 30px 'Plus Jakarta Sans', Arial, sans-serif";
    } else {
      ctx.font = "bold 36px 'Plus Jakarta Sans', Arial, sans-serif";
    }
    ctx.fillText(desc, x1 + 35, currentY + rowHeight / 2);

    ctx.fillStyle = isDebit ? "#dc2626" : "#059669";
    ctx.font = "bold 42px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.textAlign = "center";
    const sign = isDebit ? "-₹" : "+₹";
    ctx.fillText(`${sign}${formatCurrency(e.amount)}`, x2 + col3W / 2, currentY + rowHeight / 2);

    currentY += rowHeight;
  });

  // 4. Remaining Balance (Soft Mint Green #e8f8ed)
  ctx.fillStyle = "#e8f8ed";
  ctx.fillRect(0, currentY, baseWidth, rowHeight);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 38px 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = "center";
  const remDate = calc.lastDate || cust.oldBalanceDate || getTodayText();
  ctx.fillText(remDate, x0 + col1W / 2, currentY + rowHeight / 2);

  ctx.fillStyle = "#006400";
  ctx.font = "bold 40px 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Remaining Balance", x1 + 35, currentY + rowHeight / 2);

  ctx.textAlign = "center";
  ctx.fillText(`₹${formatCurrency(calc.remaining)}`, x2 + col3W / 2, currentY + rowHeight / 2);

  // 5. Crisp Black Border Grid (Zero icons, 100% plain)
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, baseWidth - 3, baseHeight - 3);

  ctx.beginPath();
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, baseHeight);
  ctx.moveTo(x2, 0);
  ctx.lineTo(x2, baseHeight);
  ctx.stroke();

  let lineY = headerHeight;
  for (let i = 0; i < totalRows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(baseWidth, lineY);
    ctx.stroke();
    lineY += rowHeight;
  }

  const url = canvas.toDataURL("image/png");
  if (callback) callback(url);
}

function downloadStatementPhoto() {
  generatePhotoSlipImage(dataUrl => {
    const cust = getActiveCustomer();
    const name = cust ? cust.name.replace(/\s+/g, "_") : "Statement";
    const filename = `${name}_Statement_${Date.now()}.png`;

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

function shareStatementWhatsApp() {
  const cust = getActiveCustomer();
  if (!cust) return;

  const calc = calculateCustomer(cust);
  let text = `*CAL LEDGER - STATEMENT*\n*Customer: ${cust.name.toUpperCase()}*\n`;
  text += `━━━━━━━━━━━━━━━━━━\n`;
  if (Math.abs(calc.oldBal) >= 1) {
    text += `🔹 *Date:* ${cust.oldBalanceDate || "Old"}\n`;
    text += `🔹 *Old Balance:* ₹${formatCurrency(calc.oldBal)}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
  }

  (cust.entries || []).forEach(e => {
    const sign = e.type === "DEBIT" ? "-₹" : "+₹";
    text += `📅 ${e.date}: ${e.description} ➜ *${sign}${formatCurrency(e.amount)}*\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━\n`;
  text += `✅ *REMAINING BALANCE: ₹${formatCurrency(calc.remaining)}*\n`;
  text += `━━━━━━━━━━━━━━━━━━\n`;
  text += `(Downloaded via Cal Ledger App)`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

// Clear All Data
function resetAllData() {
  const confirmMsg = "⚠️ Clear all customers and transactions from local storage and SQLite database?";
  if (confirm(confirmMsg)) {
    AppState = { activeCustomerId: null, customers: [] };
    ensureActiveCustomer();
    saveState();
    closeSideDrawer();
    renderCalculationScreen();
    alert("All data cleared.");
  }
}

// Load Demo Data
function loadReferenceDemo() {
  if (confirm("Load sample demo data (P. Lakshmi Kumar & Dhana Account)?")) {
    AppState.customers = JSON.parse(JSON.stringify(REFERENCE_DEMO_DATA));
    AppState.activeCustomerId = AppState.customers[0].id;
    saveState();
    closeSideDrawer();
    renderCalculationScreen();
  }
}

// =========================================================
// MODALS LOGIC
// =========================================================

// Customer Modal
function openAddCustomerModal() {
  document.getElementById("newCustName").value = "";
  document.getElementById("newCustPhone").value = "";
  document.getElementById("newCustOldBal").value = "0";
  document.getElementById("newCustOldBalDate").value = getTodayText();
  document.getElementById("addCustomerModal").classList.add("active");
  setTimeout(() => document.getElementById("newCustName").focus(), 150);
}

function closeAddCustomerModal() {
  document.getElementById("addCustomerModal").classList.remove("active");
}

document.getElementById("addCustomerForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("newCustName").value.trim();
  const phone = document.getElementById("newCustPhone").value.trim();
  const oldBal = parseFloat(document.getElementById("newCustOldBal").value) || 0;
  const oldBalDate = document.getElementById("newCustOldBalDate").value.trim() || getTodayText();

  if (!name) return;

  const newCust = {
    id: "cust_" + Date.now(),
    name,
    phone,
    oldBalance: oldBal,
    oldBalanceDate: oldBalDate,
    entries: []
  };

  AppState.customers.push(newCust);
  AppState.activeCustomerId = newCust.id;
  saveState();
  closeAddCustomerModal();
  closeSideDrawer();
  renderCalculationScreen();
});

// Customer Edit Modal
let editingCustomerId = null;

window.openEditCustomerModal = function(custId) {
  const targetId = custId || AppState.activeCustomerId;
  const c = AppState.customers.find(item => item.id === targetId) || getActiveCustomer();
  if (!c) return;

  editingCustomerId = c.id;
  document.getElementById("editCustName").value = c.name;
  document.getElementById("editCustPhone").value = c.phone || "";
  document.getElementById("editCustomerModal").classList.add("active");
  setTimeout(() => document.getElementById("editCustName").focus(), 150);
};

window.closeEditCustomerModal = function() {
  document.getElementById("editCustomerModal").classList.remove("active");
  editingCustomerId = null;
};

document.getElementById("editCustomerForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("editCustName").value.trim();
  const phone = document.getElementById("editCustPhone").value.trim();
  if (!name) return;

  const targetId = editingCustomerId || AppState.activeCustomerId;
  const c = AppState.customers.find(item => item.id === targetId);
  if (c) {
    c.name = name;
    c.phone = phone;
    saveState();
    closeEditCustomerModal();
    renderCalculationScreen();
    renderDrawerCustomersList();
  }
});

// Entry Modal (Strictly DEBITED / CREDITED)
let activeEntryType = "DEBIT";
let editingEntryId = null;

function openEntryModal(type = "DEBIT") {
  const cust = getActiveCustomer();
  if (!cust) return;

  editingEntryId = null;
  activeEntryType = type;
  setEntryTab(type);

  document.getElementById("entryDialogTitle").textContent = "Record Entry";
  document.getElementById("saveEntryBtn").textContent = "Save Entry";

  document.getElementById("entryAmountField").value = "";
  document.getElementById("entryDateTextField").value = getTodayText();
  document.getElementById("entryDescField").value = type === "DEBIT" ? "Paid" : "Received";

  document.getElementById("addEntryModal").classList.add("active");
  setTimeout(() => document.getElementById("entryAmountField").focus(), 150);
}

window.openEditEntryModal = function(entryId) {
  const cust = getActiveCustomer();
  if (!cust) return;

  const entry = (cust.entries || []).find(e => e.id === entryId);
  if (!entry) return;

  editingEntryId = entryId;
  activeEntryType = entry.type || "DEBIT";
  setEntryTab(activeEntryType);

  document.getElementById("entryDialogTitle").textContent = "Edit Entry";
  document.getElementById("saveEntryBtn").textContent = "Update Entry";

  document.getElementById("entryAmountField").value = entry.amount;
  document.getElementById("entryDateTextField").value = entry.date || getTodayText();
  document.getElementById("entryDescField").value = entry.description || "";

  document.getElementById("addEntryModal").classList.add("active");
  setTimeout(() => document.getElementById("entryAmountField").focus(), 150);
};

function closeEntryModal() {
  editingEntryId = null;
  document.getElementById("addEntryModal").classList.remove("active");
}

function setEntryTab(type) {
  activeEntryType = type;
  if (type === "DEBIT") {
    document.getElementById("tabDebitChoice").classList.add("active");
    document.getElementById("tabCreditChoice").classList.remove("active");
  } else {
    document.getElementById("tabCreditChoice").classList.add("active");
    document.getElementById("tabDebitChoice").classList.remove("active");
  }
}

window.applyQuickNote = function(note) {
  document.getElementById("entryDescField").value = note;
};

document.getElementById("addEntryForm").addEventListener("submit", e => {
  e.preventDefault();
  const cust = getActiveCustomer();
  if (!cust) return;

  const amt = parseFloat(document.getElementById("entryAmountField").value);
  const dateStr = document.getElementById("entryDateTextField").value.trim() || getTodayText();
  const desc = document.getElementById("entryDescField").value.trim();

  if (isNaN(amt) || amt <= 0) {
    alert("Please enter a valid amount greater than 0");
    return;
  }
  if (!desc) {
    alert("Please enter a description note");
    return;
  }

  if (!cust.entries) cust.entries = [];

  if (editingEntryId) {
    const entry = cust.entries.find(item => item.id === editingEntryId);
    if (entry) {
      entry.amount = amt;
      entry.date = dateStr;
      entry.description = desc;
      entry.type = activeEntryType;
    }
    editingEntryId = null;
  } else {
    cust.entries.push({
      id: "entry_" + Date.now(),
      date: dateStr,
      description: desc,
      type: activeEntryType,
      amount: amt
    });
  }

  saveState();
  closeEntryModal();
  renderCalculationScreen();
});

// Edit Old Balance Modal
function openEditOldBalModal() {
  const cust = getActiveCustomer();
  if (!cust) return;

  document.getElementById("editOldBalInput").value = cust.oldBalance;
  document.getElementById("editOldBalDateInput").value = cust.oldBalanceDate || getTodayText();
  document.getElementById("editOldBalModal").classList.add("active");
  setTimeout(() => document.getElementById("editOldBalInput").focus(), 150);
}

function closeEditOldBalModal() {
  document.getElementById("editOldBalModal").classList.remove("active");
}

document.getElementById("saveEditOldBalBtn").addEventListener("click", () => {
  const cust = getActiveCustomer();
  if (!cust) return;

  const amt = parseFloat(document.getElementById("editOldBalInput").value);
  const dt = document.getElementById("editOldBalDateInput").value.trim() || getTodayText();

  if (isNaN(amt)) {
    alert("Please enter a valid amount");
    return;
  }

  cust.oldBalance = amt;
  cust.oldBalanceDate = dt;
  saveState();
  closeEditOldBalModal();
  renderCalculationScreen();
});

// Calculator
let calcMathStr = "";
function toggleCalcPopup() {
  document.getElementById("calcPopup").classList.toggle("active");
}

function handleCalcKey(k) {
  if (k === "clear") {
    calcMathStr = "";
  } else if (k === "back") {
    calcMathStr = calcMathStr.slice(0, -1);
  } else if (k === "=") {
    try {
      const sanitized = calcMathStr.replace(/×/g, "*").replace(/÷/g, "/");
      const res = Function(`'use strict'; return (${sanitized})`)();
      document.getElementById("calcMathVal").textContent = isFinite(res) ? formatCurrency(res) : "Error";
      calcMathStr = String(res);
      document.getElementById("calcMathExpr").textContent = calcMathStr;
      return;
    } catch (e) {
      document.getElementById("calcMathVal").textContent = "Error";
      return;
    }
  } else {
    calcMathStr += k;
  }

  document.getElementById("calcMathExpr").textContent = calcMathStr;
  try {
    const sanitized = calcMathStr.replace(/×/g, "*").replace(/÷/g, "/");
    const res = Function(`'use strict'; return (${sanitized})`)();
    if (isFinite(res)) {
      document.getElementById("calcMathVal").textContent = formatCurrency(res);
    }
  } catch (e) {}
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAll() {
  renderCalculationScreen();
  renderDrawerCustomersList();
}

// =========================================================
// INITIALIZATION
// =========================================================

function init() {
  loadState();

  // Drawer Toggles (==== button & overlay)
  document.getElementById("openMenuDrawerBtn").addEventListener("click", openSideDrawer);
  document.getElementById("activeCustHeaderBox").addEventListener("click", openSideDrawer);
  document.getElementById("closeDrawerBtn").addEventListener("click", closeSideDrawer);
  document.getElementById("drawerOverlay").addEventListener("click", closeSideDrawer);
  document.getElementById("drawerCustomerSearch").addEventListener("input", renderDrawerCustomersList);

  // Drawer Actions
  document.getElementById("openAddCustomerDrawerBtn").addEventListener("click", openAddCustomerModal);
  document.getElementById("drawerClearAllBtn").addEventListener("click", resetAllData);
  document.getElementById("drawerDemoBtn").addEventListener("click", loadReferenceDemo);

  // Screen Actions
  document.getElementById("btnOpenDebitEntry").addEventListener("click", () => openEntryModal("DEBIT"));
  document.getElementById("btnOpenCreditEntry").addEventListener("click", () => openEntryModal("CREDIT"));
  document.getElementById("goToStatementBtn").addEventListener("click", showStatementSlipScreen);
  document.getElementById("backToCalcBtn").addEventListener("click", backToCalculationScreen);
  document.getElementById("btnCarryForward").addEventListener("click", carryForwardActiveCustomer);
  document.getElementById("btnEditOldBal").addEventListener("click", openEditOldBalModal);

  // Old Balance History Modal Actions
  const btnViewOldHist = document.getElementById("btnViewOldHistory");
  if (btnViewOldHist) btnViewOldHist.onclick = openOldHistoryModal;
  const pillOldBal = document.getElementById("pillOldBalBox");
  if (pillOldBal) pillOldBal.onclick = openOldHistoryModal;
  const closeOldHistBtn = document.getElementById("closeOldHistoryModalBtn");
  if (closeOldHistBtn) closeOldHistBtn.onclick = closeOldHistoryModal;
  const closeOldHistBtmBtn = document.getElementById("closeOldHistoryBottomBtn");
  if (closeOldHistBtmBtn) closeOldHistBtmBtn.onclick = closeOldHistoryModal;
  const clearAllOldHistBtn = document.getElementById("clearAllOldHistoryBtn");
  if (clearAllOldHistBtn) clearAllOldHistBtn.onclick = clearAllOldHistory;

  // Sort Toggle Button
  const sortToggleBtn = document.getElementById("sortOrderToggleBtn");
  if (sortToggleBtn) {
    sortToggleBtn.onclick = toggleSortOrder;
  }

  // Statement Actions
  document.getElementById("btnDownloadStatementPhoto").addEventListener("click", downloadStatementPhoto);
  document.getElementById("btnShareStatementWhatsApp").addEventListener("click", shareStatementWhatsApp);

  // Modals
  document.getElementById("closeAddCustomerModalBtn").addEventListener("click", closeAddCustomerModal);
  document.getElementById("cancelAddCustomerBtn").addEventListener("click", closeAddCustomerModal);
  
  // Customer Edit Modal
  const btnEditCust = document.getElementById("btnEditCustName");
  if (btnEditCust) {
    btnEditCust.addEventListener("click", e => {
      e.stopPropagation();
      openEditCustomerModal(AppState.activeCustomerId);
    });
  }
  document.getElementById("closeEditCustomerModalBtn").addEventListener("click", closeEditCustomerModal);
  document.getElementById("cancelEditCustomerBtn").addEventListener("click", closeEditCustomerModal);

  document.getElementById("closeEntryModalBtn").addEventListener("click", closeEntryModal);
  document.getElementById("cancelEntryBtn").addEventListener("click", closeEntryModal);
  document.getElementById("tabDebitChoice").addEventListener("click", () => setEntryTab("DEBIT"));
  document.getElementById("tabCreditChoice").addEventListener("click", () => setEntryTab("CREDIT"));
  document.getElementById("closeEditOldBalModalBtn").addEventListener("click", closeEditOldBalModal);
  document.getElementById("cancelEditOldBalBtn").addEventListener("click", closeEditOldBalModal);

  // Calculator
  document.getElementById("calcOpenBtn").addEventListener("click", toggleCalcPopup);
  document.getElementById("closeCalcPopupBtn").addEventListener("click", toggleCalcPopup);
  document.querySelectorAll(".calc-k").forEach(b => {
    b.addEventListener("click", () => handleCalcKey(b.getAttribute("data-k")));
  });

  // Render initial active customer calculation view
  renderCalculationScreen();
}

document.addEventListener("DOMContentLoaded", init);
