/**
 * MilkBook v2.1 — Main Application Controller
 * Features:
 *   - Admin: full dashboard, entry, customer management, reports
 *   - Customer: login with phone → read-only portal of own data
 *   - Auto-save: debounced 1.5s auto-save on entry changes
 */

import {
    initDB, getCustomers, saveCustomer, deleteCustomer,
    getDailyRecords, saveDailyRecord, getDailyRecord,
    recordPayment, getSettings, saveSettings, getPayments, deleteMonthPayments,
    getLifetimeStats, getLocalData
} from './db.js';
import { SEED_CUSTOMERS } from './seed-data.js';
import {
    calcDailyAmount, calcMonthlyTotals, formatCurrency,
    formatDate, getMonthName, getDaysInMonth, getPrevMonth, getNextMonth
} from './calculations.js';
import { downloadCustomerCSV, downloadAllCSV, generateIndividualPDF, generateSummaryPDF } from './reports.js';
import { initDriveSync } from './drive-sync.js';

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
const state = {
    user: null,
    role: null,        // 'admin' or 'customer'
    customers: [],
    currentCustomer: null,
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
    entryDate: new Date(),
    settings: { rate: 60, businessName: 'MilkBook', address: '' },
    reportMonth: new Date().getMonth() + 1,
    reportYear: new Date().getFullYear(),
    reportDate: new Date(),
    portalMonth: new Date().getMonth() + 1,
    portalYear: new Date().getFullYear(),
    autoSaveTimer: null,
    portalCustomer: null,
    dashDate: new Date(),
    dashSession: new Date().getHours() < 12 ? 'm' : 'e',
    entrySession: 'm', // 'm' or 'e'
    reportPeriod: 'month', // 'daily', 'week', 'month', 'year', 'custom'
    reportEndDate: null,
    paymentQr: null, // Base64 string of the QR image
    reportSelections: new Set(),
};

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
function $(id) { return document.getElementById(id); }

function toast(msg, type = '') {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' toast--' + type : '');
    setTimeout(() => { t.className = 'toast'; }, 3200);
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    $(id)?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function openModal(id) { $(id)?.classList.remove('hidden'); }
function closeModal(id) { $(id)?.classList.add('hidden'); }

function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToString(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════ */
async function boot() {
    try {
        await initDB();

        // Init Google Sync infrastructure
        try { initDriveSync(); } catch (e) { console.warn("Google API load skip", e); }

        const s = await getSettings();
        if (s) {
            state.settings = { ...state.settings, ...s };
            if (s.rate) { $('rateInput').value = s.rate; }
            if (s.businessName) { $('businessNameInput').value = s.businessName; }
            if (s.address) { $('addressInput').value = s.address; }
            if (s.paymentQr) {
                state.paymentQr = s.paymentQr;
                updateQrUI();
            }
        }

        if (window.__FB_READY) await window.__FB_READY;
        // initAuth(onAuthChange);
        $('globalLoader').classList.add('hidden');
        $('app').classList.remove('hidden');

        await checkAndSeedData();

        state.role = 'admin';
        state.isAdmin = true;
        await loadDashboard();
    } catch (e) {
        console.error('Boot error', e);
        $('globalLoader').classList.add('hidden');
        $('app').classList.remove('hidden');
        showPage('page-login');
    }
}

/* ═══════════════════════════════════════════
   AUTH & ROLE DETECTION
═══════════════════════════════════════════ */

async function checkAndSeedData() {
    try {
        const customers = await getCustomers();
        console.log(`📡 Cloud Sync: Checking customers... Found ${customers.length} on server.`);

        let addedCount = 0;
        for (const item of SEED_CUSTOMERS) {
            const exists = customers.some(c => c.name === item.name);
            if (!exists) {
                await saveCustomer({
                    name: item.name,
                    phone: item.phone,
                    address: "",
                    default_qty: 1,
                    total_balance: 0
                });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            console.log(`✅ Success: Pushed ${addedCount} new customers to your Cloud Database.`);
            state.customers = await getCustomers();
        } else {
            console.log("ℹ️ Cloud Database is already up to date.");
        }
    } catch (e) {
        console.error("❌ Sync Error: Could not push data. Check your Firestore Rules or Internet connection.", e);
    }
}

async function manualPushToFirebase() {
    const btn = document.getElementById('manualPushBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Pushing to Firestore...";
    }

    try {
        console.log("🚀 Manual Sync: Starting push...");
        // 1. Get current local state
        const s = getLocalData();
        const localCustomers = Object.entries(s.customers || {}).map(([id, data]) => ({ id, ...data }));

        // 2. Get current Firestore state
        const cloudCustomers = await getCustomers();
        console.log(`📊 Current Status: Local=${localCustomers.length} | Cloud=${cloudCustomers.length}`);

        let pushedCount = 0;
        for (const localCust of localCustomers) {
            // Check if this customer (by name) exists in cloud
            const exists = cloudCustomers.some(c => c.name === localCust.name);
            if (!exists) {
                console.log(`⬆️ Pushing: ${localCust.name}`);
                await saveCustomer({
                    name: localCust.name,
                    phone: localCust.phone || "",
                    address: localCust.address || "",
                    default_qty: localCust.default_qty || 1,
                    total_balance: localCust.total_balance || 0
                });
                pushedCount++;
            }
        }

        if (pushedCount > 0) {
            alert(`✅ Successfully pushed ${pushedCount} members to Firestore!`);
            state.customers = await getCustomers();
            renderCustomerList(state.customers);
        } else {
            alert("ℹ️ Your cloud database is already up-to-date with your local data.");
        }
    } catch (e) {
        console.error("❌ Push Failed", e);
        alert("❌ Push failed. Check your internet connection or Firestore rules.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "🚀 Push to Firestore Now";
        }
    }
}

/* ═══════════════════════════════════════════
   CUSTOMER PORTAL (Read-Only)
═══════════════════════════════════════════ */
async function openCustomerPortal(cust) {
    state.portalCustomer = cust;
    state.portalMonth = new Date().getMonth() + 1;
    state.portalYear = new Date().getFullYear();

    const initial = (cust.name || '?')[0].toUpperCase();
    $('portalAvatar').textContent = initial;
    $('portalName').textContent = cust.name;
    $('portalPhone').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:middle;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${cust.phone || '—'}`;

    showPage('page-portal');
    await loadPortalMonth();
}

async function loadPortalMonth() {
    const cust = state.portalCustomer;
    const { portalMonth: m, portalYear: y, settings } = state;
    $('portalMonthDisplay').textContent = `${getMonthName(m)} ${y}`;

    try {
        const records = await getDailyRecords(cust.id, y, m).catch(() => []);
        const payments = await getPayments(cust.id, y, m).catch(() => []);
        const paidAmt = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const totals = calcMonthlyTotals(records, settings.rate);
        const outstanding = Math.max(0, totals.totalAmount - paidAmt);

        $('portalSummLitres').textContent = `${totals.totalLitres} L`;
        $('portalSummBill').textContent = formatCurrency(totals.totalAmount);
        $('portalSummPaid').textContent = formatCurrency(paidAmt);
        $('portalSummDue').textContent = formatCurrency(outstanding);

        // Pay banner
        const banner = $('portalPayBanner');
        if (outstanding <= 0) {
            banner.className = 'pay-status-banner pay-status-banner--paid';
            $('portalPayText').className = 'pay-status-text pay-status-text--paid';
            $('portalPayText').textContent = '✅ All Paid';
            $('portalPayAmount').textContent = paidAmt > 0 ? formatCurrency(paidAmt) : 'No bill this month';
        } else {
            banner.className = 'pay-status-banner pay-status-banner--due';
            $('portalPayText').className = 'pay-status-text pay-status-text--due';
            $('portalPayText').textContent = '⚠️ Outstanding Balance';
            $('portalPayAmount').textContent = formatCurrency(outstanding);
        }

        renderDailyHistory(records, 'portalHistoryList');
    } catch (err) {
        console.error(err);
        $('portalHistoryList').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Could not load data</div></div>`;
    }
}

/* ═══════════════════════════════════════════
   DASHBOARD (Admin)
═══════════════════════════════════════════ */
async function loadDashboard() {
    showPage('page-dashboard');
    const d = state.dashDate || new Date();
    const sess = state.dashSession || 'm';

    // Update display date
    const labelDate = formatDate(d, 'entry');
    $('dashHeroDate').textContent = labelDate;

    // Update session selector UI
    document.querySelectorAll('#dashSessionToggle .session-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.session === sess);
    });

    // Greeting
    const hr = new Date().getHours();
    const greeting = hr < 12 ? 'Good morning 👋' : hr < 17 ? 'Good afternoon 👋' : 'Good evening 👋';
    document.querySelector('.hero-greeting').textContent = greeting;

    try {
        const customers = await getCustomers();
        state.customers = customers;
        const d_str = dateToString(d);
        let enteredCount = 0, pendingCount = 0;

        const enriched = await Promise.all(customers.map(async c => {
            const rec = await getDailyRecord(c.id, d_str).catch(() => null);

            const mQty = rec?.morning_qty || 0;
            const eQty = rec?.evening_qty || 0;
            const hasRecord = rec !== null;

            // Session-based progress stats
            const sQty = sess === 'm' ? mQty : eQty;
            const isEntered = sQty > 0;

            if (isEntered) enteredCount++;
            else pendingCount++;

            // Card status for visual indicators (Green for entered, Amber/Red for pending)
            const status = isEntered ? 'done' : 'pending';

            return {
                ...c,
                status,
                isSessionEntered: isEntered,
                hasTodayEntry: status === 'done',
                session: {
                    litres: { m: mQty, e: eQty },
                    status: { m: mQty > 0, e: eQty > 0 }
                }
            };
        }));

        // Sort: Pending (not entered) first
        enriched.sort((a, b) => {
            if (a.isSessionEntered === b.isSessionEntered) return 0;
            return a.isSessionEntered ? 1 : -1;
        });

        state.customers = enriched;

        const total = customers.length;
        if ($('statTotal')) $('statTotal').textContent = total;
        if ($('statEntered')) $('statEntered').textContent = enteredCount;
        if ($('statPending')) $('statPending').textContent = pendingCount;

        renderCustomerList(enriched);
    } catch (e) {
        console.error(e);
        $('customerListContainer').innerHTML = `<div class="empty-state">⚠️ Error loading data</div>`;
    }
}

function renderCustomerList(list) {
    const container = $('customerListContainer');
    if (!list.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No customers yet</div><div class="empty-sub">Tap + to add your first customer</div></div>`;
        return;
    }
    container.innerHTML = list.map(c => {
        const initial = (c.name || '?')[0].toUpperCase();
        const statusClass = `customer-card--${c.status}`;
        const s = c.session;

        const mChip = `
            <div class="session-chip ${s.status.m ? 'session-chip--poured' : 'session-chip--skipped'}">
                <span class="session-badge-label">M</span>
                <span class="session-badge-value">
                    <span class="session-icon">${s.status.m ? '●' : '○'}</span>
                    ${s.litres.m}L
                </span>
            </div>`;

        const eChip = `
            <div class="session-chip ${s.status.e ? 'session-chip--poured' : 'session-chip--skipped'}">
                <span class="session-badge-label">E</span>
                <span class="session-badge-value">
                    <span class="session-icon">${s.status.e ? '●' : '○'}</span>
                    ${s.litres.e}L
                </span>
            </div>`;

        return `
    <div class="customer-card ${statusClass}" data-id="${c.id}">
      <div class="customer-avatar" data-action="call" data-phone="${c.phone || ''}">${initial}</div>
      <div class="customer-info" data-action="view">
        <div class="customer-name">${c.name}</div>
        <div class="customer-phone">${c.phone || '—'}</div>
      </div>
      <div class="customer-session-stats" data-action="view">
        ${mChip}
        ${eChip}
      </div>
      <div class="customer-meta">
        <button class="card-action-btn card-action-btn--entry" data-id="${c.id}" data-action="entry">Entry</button>
      </div>
    </div>`;
    }).join('');

    container.querySelectorAll('.customer-card').forEach(card => {
        card.addEventListener('click', e => {
            const entryBtn = e.target.closest('[data-action="entry"]');
            if (entryBtn) {
                e.stopPropagation();
                openEntryPage(entryBtn.dataset.id);
                return;
            }

            const callBtn = e.target.closest('[data-action="call"]');
            if (callBtn && callBtn.dataset.phone) {
                e.stopPropagation();
                window.location.href = `tel:${callBtn.dataset.phone}`;
                return;
            }

            // Tapping anywhere else on the card → go to details
            openCustomerView(card.dataset.id);
        });
    });
}

/* ═══════════════════════════════════════════
   DATA ENTRY PAGE (with Auto-Save)
═══════════════════════════════════════════ */
function openEntryPage(customerId) {
    const cust = state.customers.find(c => c.id === customerId);
    if (!cust) return;
    state.currentCustomer = cust;
    state.entryDate = new Date();
    // Default entry page session to dashboard session
    state.entrySession = state.dashSession || (new Date().getHours() < 12 ? 'm' : 'e');

    $('entryCustomerName').textContent = cust.name;
    $('entryCustomerPhone').textContent = cust.phone || '';
    $('rateInfoChip').textContent = `Rate: ${formatCurrency(state.settings.rate)}/L`;
    showPage('page-entry');
    renderEntryDate();
    updateEntrySessionUI();
    loadEntryForDate();
    renderEntryHistory();
}

async function renderEntryHistory() {
    const cust = state.currentCustomer;
    const historyList = $('entryHistoryList');
    if (!cust || !historyList) return;

    const period = state.historyPeriod || 'week';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
        const records = await getDailyRecords(cust.id, year, month);
        let displayRecs = records;

        if (period === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            const weekAgoStr = dateToString(weekAgo);
            displayRecs = records.filter(r => r.date >= weekAgoStr);
        }

        // Sort descending (latest first)
        displayRecs.sort((a, b) => b.date.localeCompare(a.date));

        if (displayRecs.length === 0) {
            historyList.innerHTML = `<div class="history-placeholder">No records found for this ${period}.</div>`;
            return;
        }

        historyList.innerHTML = displayRecs.map(rec => {
            const d = new Date(rec.date + 'T00:00:00');
            const dayNum = d.getDate();
            const monthName = d.toLocaleString('default', { month: 'short' });

            return `
                <div class="history-item">
                    <div class="history-date-box">
                        <span class="history-date-day">${dayNum}</span>
                        <span class="history-date-month">${monthName}</span>
                    </div>
                    <div class="history-qty-details">
                        <div class="history-session-info">
                            <span class="history-icon">🌅</span>
                            <span class="history-qty-val">${rec.morning_qty || 0}L</span>
                        </div>
                        <div class="history-session-info">
                            <span class="history-icon">🌙</span>
                            <span class="history-qty-val">${rec.evening_qty || 0}L</span>
                        </div>
                    </div>
                    <div class="history-total-info">
                        <span class="history-total-amt">${formatCurrency(rec.daily_amount)}</span>
                        <span class="history-total-litres">${rec.total_litres || 0} L</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        historyList.innerHTML = `<div class="history-placeholder">Error loading history.</div>`;
    }
}

function updateEntrySessionUI() {
    const sess = state.entrySession;
    const isM = sess === 'm';

    // Update Toggle Buttons
    document.querySelectorAll('.entry-session-pill .pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.session === sess);
    });

    // Show/Hide Cards
    const morningCard = $('morningEntryCardContainer');
    const eveningCard = $('eveningEntryCardContainer');
    if (morningCard) morningCard.style.display = isM ? 'block' : 'none';
    if (eveningCard) eveningCard.style.display = isM ? 'none' : 'block';
}

function renderEntryDate() {
    $('entryDateDisplay').textContent = formatDate(state.entryDate, 'entry');
}

async function loadEntryForDate() {
    const dateStr = dateToString(state.entryDate);
    setAutosaveStatus('idle');
    try {
        const rec = await getDailyRecord(state.currentCustomer.id, dateStr);
        $('morningQty').value = rec?.morning_qty ?? 0;
        $('eveningQty').value = rec?.evening_qty ?? 0;
        $('morningCollected').checked = rec?.morning_collected !== false;
        $('eveningCollected').checked = rec?.evening_collected !== false;
        updateLiveTotal();
    } catch {
        $('morningQty').value = 0;
        $('eveningQty').value = 0;
        $('morningCollected').checked = true;
        $('eveningCollected').checked = true;
        updateLiveTotal();
    }
}

function setAutosaveStatus(status) {
    const el = $('autosaveStatus');
    if (!el) return;
    el.className = 'autosave-status';
    if (status === 'saving') {
        el.classList.add('autosave-status--saving');
        el.textContent = '⏳ Saving…';
    } else if (status === 'saved') {
        el.classList.add('autosave-status--saved');
        el.textContent = '✅ Auto-saved';
        setTimeout(() => setAutosaveStatus('idle'), 2500);
    } else {
        el.classList.add('autosave-status--idle');
        el.textContent = state.autoSaveTimer ? '⏳ Saving…' : '⏺ Changes auto-saved';
    }
}

function scheduleAutoSave() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    setAutosaveStatus('saving');
    state.autoSaveTimer = setTimeout(async () => {
        state.autoSaveTimer = null;
        await performSave(true);
    }, 1500);
}



function updateLiveTotal() {
    const m = parseFloat($('morningQty').value) || 0;
    const e = parseFloat($('eveningQty').value) || 0;
    const result = calcDailyAmount(m, e, state.settings.rate);
    $('liveTotalAmount').textContent = formatCurrency(result.amount);
    $('liveTotalLitres').textContent = `${result.litres} L`;
    const card = $('liveTotalCard');
    card.classList.remove('pulse');
    void card.offsetWidth;
    card.classList.add('pulse');
}

async function performSave(isAuto = false) {
    const cust = state.currentCustomer;
    if (!cust) return;
    const dateStr = dateToString(state.entryDate);
    const m = parseFloat($('morningQty').value) || 0;
    const e = parseFloat($('eveningQty').value) || 0;
    const calc = calcDailyAmount(m, e, state.settings.rate);

    try {
        await saveDailyRecord(cust.id, dateStr, {
            date: dateStr,
            morning_qty: m,
            evening_qty: e,
            morning_collected: $('morningCollected').checked,
            evening_collected: $('eveningCollected').checked,
            total_litres: calc.litres,
            rate_per_litre: state.settings.rate,
            daily_amount: calc.amount,
            no_delivery: (m + e) === 0,
        });

        if (isAuto) {
            setAutosaveStatus('saved');
        } else {
            toast('Entry saved ✓', 'success');
            await loadDashboard();
            setTimeout(() => showPage('page-dashboard'), 400);
        }
        renderEntryHistory(); // Refresh history on current page
    } catch (err) {
        if (isAuto) {
            setAutosaveStatus('idle');
        } else {
            toast('Save failed: ' + err.message, 'error');
        }
    }
}

async function saveEntry() {
    const btn = $('saveEntryBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span> Saving…`;
    await performSave(false);
    btn.disabled = false;
    btn.innerHTML = '💾 Save Entry';
}

/* ═══════════════════════════════════════════
   CUSTOMER VIEW PAGE (Admin)
═══════════════════════════════════════════ */
async function openCustomerView(customerId) {
    const cust = state.customers.find(c => c.id === customerId);
    if (!cust) return;
    state.currentCustomer = cust;
    state.currentMonth = new Date().getMonth() + 1;
    state.currentYear = new Date().getFullYear();
    showPage('page-customer');
    renderCustomerHero(cust);
    await loadCustomerMonth();
}

function renderCustomerHero(cust) {
    const initial = (cust.name || '?')[0].toUpperCase();
    $('customerViewName').textContent = cust.name;
    $('customerViewSub').textContent = cust.phone || '';
    $('customerHeroAvatar').textContent = initial;
    $('customerHeroName').textContent = cust.name;
    $('customerHeroPhone').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:middle;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${cust.phone || '—'}`;
    $('customerHeroAddress').textContent = cust.address ? `📍 ${cust.address}` : '';
}

async function loadCustomerMonth() {
    const cust = state.currentCustomer;
    const { currentMonth: m, currentYear: y, settings } = state;
    $('monthDisplay').textContent = `${getMonthName(m)} ${y}`;

    try {
        const records = await getDailyRecords(cust.id, y, m);
        const payments = await getPayments(cust.id, y, m).catch(() => []);
        const totals = calcMonthlyTotals(records, settings.rate);
        const paidAmt = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const outstanding = totals.totalAmount - paidAmt;

        $('summLitres').textContent = `${totals.totalLitres} L`;
        $('summBill').textContent = formatCurrency(totals.totalAmount);
        $('summDays').textContent = totals.daysDelivered;
        $('summOutstanding').textContent = formatCurrency(Math.max(0, outstanding));

        // Lifetime Stats
        const lifetime = await getLifetimeStats(cust.id);
        $('lifetimeLitres').textContent = `${lifetime.totalLitres.toFixed(1)}L`;
        $('lifetimeRevenue').textContent = formatCurrency(lifetime.totalRevenue);
        $('lifetimePaid').textContent = formatCurrency(lifetime.totalPaid);

        // Pay banner
        const banner = $('payStatusBanner');
        if (outstanding <= 0) {
            banner.className = 'pay-status-banner pay-status-banner--paid';
            $('payStatusText').className = 'pay-status-text pay-status-text--paid';
            $('payStatusText').textContent = '✅ All Paid';
            $('payStatusAmount').textContent = paidAmt > 0 ? `Paid: ${formatCurrency(paidAmt)}` : 'No bill this month';
        } else {
            banner.className = 'pay-status-banner pay-status-banner--due';
            $('payStatusText').className = 'pay-status-text pay-status-text--due';
            $('payStatusText').textContent = '⚠️ Outstanding Balance';
            $('payStatusAmount').textContent = formatCurrency(outstanding);
        }

        renderDailyHistory(records, 'dailyHistoryList');

        // Payment History List
        const allPayments = await getPayments(cust.id).catch(() => []);
        const payList = $('paymentHistoryList');
        if (!allPayments.length) {
            payList.innerHTML = `<div class="empty-state">No payment history</div>`;
        } else {
            const sortedPays = [...allPayments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            payList.innerHTML = sortedPays.map(p => `
                <div class="payment-row">
                    <div class="payment-row-info">
                        <span class="payment-row-note">${p.note || 'Cash Payment'}</span>
                        <span class="payment-row-date">${formatDate(new Date(p.date || p.created_at || Date.now()), 'short')}</span>
                    </div>
                    <span class="payment-row-amt">+ ${formatCurrency(p.amount)}</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error(err);
        $('dailyHistoryList').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load data</div></div>`;
    }
}

function renderDailyHistory(records, containerId = 'dailyHistoryList') {
    const list = $(containerId);
    if (!records || !records.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No entries this month</div><div class="empty-sub">No deliveries recorded yet</div></div>`;
        return;
    }

    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

    list.innerHTML = sorted.map(rec => {
        const d = new Date(rec.date + 'T00:00:00');
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const dayNum = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

        if (rec.no_delivery) {
            return `
      <div class="history-row history-row--zero">
        <div class="history-date">
          <div class="history-day">${dayName}</div>
          <div class="history-date-num">${dayNum}</div>
        </div>
        <div class="history-qty"><span class="no-delivery-label">No delivery</span></div>
        <div class="history-amount"><span class="no-delivery-label">—</span></div>
      </div>`;
        }

        const mcBadge = rec.morning_collected !== false
            ? `<span class="collect-badge collect-badge--yes">✓</span>`
            : `<span class="collect-badge collect-badge--no">⏳</span>`;
        const ecBadge = rec.evening_collected !== false
            ? `<span class="collect-badge collect-badge--yes">✓</span>`
            : `<span class="collect-badge collect-badge--no">⏳</span>`;

        return `
    <div class="history-row">
      <div class="history-date">
        <div class="history-day">${dayName}</div>
        <div class="history-date-num">${dayNum}</div>
      </div>
      <div class="history-qty">
        ${rec.morning_qty > 0 ? `<span class="qty-badge">M: ${rec.morning_qty}L</span>${mcBadge}` : ''}
        ${rec.evening_qty > 0 ? `<span class="qty-badge">E: ${rec.evening_qty}L</span>${ecBadge}` : ''}
      </div>
      <div class="history-amount">
        <div class="amount-value">${formatCurrency(rec.daily_amount)}</div>
        <div style="font-size:0.68rem;color:var(--text-muted)">${rec.total_litres}L</div>
      </div>
    </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════
   PAYMENT
═══════════════════════════════════════════ */
async function confirmPayment() {
    const cust = state.currentCustomer;
    if (!cust) return;
    const amt = parseFloat($('paymentAmount').value);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }

    const btn = $('confirmPaymentBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span> Recording…`;

    try {
        await recordPayment(cust.id, {
            amount: amt,
            method: $('paymentMethod').value,
            note: $('paymentNote').value,
            date: todayString(),
            month: state.currentMonth,
            year: state.currentYear,
        });
        closeModal('paymentModal');
        toast(`Payment of ${formatCurrency(amt)} recorded ✓`, 'success');
        await loadCustomerMonth();
        $('paymentAmount').value = '';
        $('paymentNote').value = '';
    } catch (err) {
        toast('Failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '✅ Confirm Payment';
    }
}

/* ═══════════════════════════════════════════
   REPORT SHARING
═══════════════════════════════════════════ */
async function buildReportText(type) {
    const cust = state.currentCustomer;
    if (!cust) return '';
    const { settings, currentMonth: m, currentYear: y } = state;
    let records = [];

    if (type === 'daily') {
        const rec = await getDailyRecord(cust.id, todayString()).catch(() => null);
        records = rec ? [rec] : [];
    } else if (type === 'weekly') {
        const all = await getDailyRecords(cust.id, y, m).catch(() => []);
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
        records = all.filter(r => new Date(r.date + 'T00:00:00') >= cutoff);
    } else {
        records = await getDailyRecords(cust.id, y, m).catch(() => []);
    }

    const payments = await getPayments(cust.id, y, m).catch(() => []);
    const paidAmt = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totals = calcMonthlyTotals(records, settings.rate);
    const outstanding = Math.max(0, totals.totalAmount - paidAmt);
    const label = type === 'daily' ? 'Daily Report' : type === 'weekly' ? 'Weekly Report' : `${getMonthName(m)} ${y} Report`;

    let lines = [
        `🥛 *${settings.businessName || 'MilkBook'} — ${label}*`,
        `📅 Date: ${formatDate(new Date(), 'entry')}`,
        `👤 Customer: ${cust.name}`,
        ``,
        `📊 *Summary*`,
        `• Total Litres: ${totals.totalLitres} L`,
        `• Bill Amount: ${formatCurrency(totals.totalAmount)}`,
        `• Days Delivered: ${totals.daysDelivered}`,
        `• Paid: ${formatCurrency(paidAmt)}`,
        `• *Outstanding: ${formatCurrency(outstanding)}*`,
    ];

    if (settings.address) lines.push(``, `📍 *Address:* ${settings.address}`);

    if (type !== 'daily') {
        lines.push(``, `📋 *Daily Breakdown*`);
        [...records].sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
            if (r.no_delivery) {
                lines.push(`  • ${r.date}: No delivery`);
            } else {
                const parts = [];
                if (r.morning_qty > 0) parts.push(`M:${r.morning_qty}L`);
                if (r.evening_qty > 0) parts.push(`E:${r.evening_qty}L`);
                lines.push(`  • ${r.date}: ${parts.join(', ')} = ${formatCurrency(r.daily_amount)}`);
            }
        });
    }

    lines.push(``, `_Sent via MilkBook_`);
    return lines.join('\n');
}

async function sendWhatsApp(type) {
    const cust = state.currentCustomer;
    if (!cust) return;
    const text = await buildReportText(type);
    const phone = (cust.phone || '').replace(/\D/g, '');
    const fullPhone = phone.length === 10 ? '91' + phone : phone;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
    closeModal('reportSendModal');
    toast('Opening WhatsApp…', 'info');
}

async function copyReport(type) {
    const text = await buildReportText(type);
    try {
        await navigator.clipboard.writeText(text);
        toast('Report copied ✓', 'success');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove();
        toast('Report copied ✓', 'success');
    }
    closeModal('reportSendModal');
}

function getSelectedReportType() {
    const checked = document.querySelector('input[name="reportType"]:checked');
    return checked ? checked.value : 'monthly';
}

/* ═══════════════════════════════════════════
   REPORTS PAGE
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   REPORTS PAGE
═══════════════════════════════════════════ */
async function loadReportsPage() {
    showPage('page-reports');
    const { reportMonth: m, reportYear: y, reportPeriod: period, reportDate: d } = state;

    // Update Top Navigator Label
    let label = '';
    if (period === 'daily') {
        label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        $('reportMonthPicker').type = 'date';
    } else if (period === 'week') {
        const start = new Date(d);
        start.setDate(d.getDate() - 6);
        label = `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        $('reportMonthPicker').type = 'date';
    } else if (period === 'year') {
        label = `${y}`;
        $('reportMonthPicker').type = 'number'; // Fallback or custom
    } else {
        label = `${getMonthName(m)} ${y}`;
        $('reportMonthPicker').type = 'month';
    }
    $('reportMonthDisplay').textContent = label;

    const titles = {
        daily: `Report for ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        week: 'Weekly Summary',
        month: `${getMonthName(m)} Summary`,
        year: `${y} Annual Summary`,
        custom: 'Custom Report'
    };
    $('reportHeroTitle').textContent = titles[period] || 'Summary';

    // Handle Period Button Active States
    document.querySelectorAll('.report-period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    try {
        const customers = state.customers;
        let totalLitres = 0, totalRevenue = 0, totalPaid = 0;

        const dateRange = getReportDateRange(period);
        const dataRows = await Promise.all(customers.map(async c => {
            const records = await getRangeRecords(c.id, dateRange.start, dateRange.end);
            const payments = await getRangePayments(c.id, dateRange.start, dateRange.end);

            const paidAmt = payments.reduce((s, p) => s + (p.amount || 0), 0);
            const totals = calcMonthlyTotals(records, state.settings.rate);
            const outstanding = Math.max(0, totals.totalAmount - paidAmt);

            totalLitres += totals.totalLitres;
            totalRevenue += totals.totalAmount;
            totalPaid += paidAmt;

            return { ...c, totals, paidAmt, outstanding, records };
        }));

        state.lastReportData = dataRows; // Store for bulk actions

        $('reportTotalLitres').textContent = `${totalLitres.toFixed(1)}L`;
        $('reportTotalRevenue').textContent = formatCurrency(totalRevenue);

        const list = $('reportCustomerList');
        if (!dataRows.length) {
            list.innerHTML = `<div class="empty-state">No customers found</div>`;
            return;
        }

        const now = new Date();
        const isPastMonth = y < now.getFullYear() || (y === now.getFullYear() && m < (now.getMonth() + 1));

        list.innerHTML = dataRows.map(r => {
            const initial = (r.name || '?')[0].toUpperCase();
            const isPaid = r.outstanding <= 0;
            const statusClass = isPaid ? 'is-paid' : 'is-due';
            const isSelected = state.reportSelections.has(r.id);

            return `
      <div class="report-row ${isSelected ? 'is-selected' : ''}" data-id="${r.id}" style="position:relative;">
        <div class="report-checkbox-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="report-row-content">
            <div class="report-row-top-bar">
                <div class="report-row-left">
                    <div class="customer-avatar">${initial}</div>
                    <div class="report-row-identity-info">
                        <div class="report-row-name">${r.name}</div>
                        ${r.phone ? `<div class="report-row-phone">${r.phone}</div>` : ''}
                    </div>
                </div>
                <div class="report-row-actions">
                    <button class="report-mini-call" data-phone="${r.phone || ''}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></button>
                </div>
            </div>
            <div class="report-row-data">
                <div class="data-tag">
                    <span class="data-tag-val">${r.totals.totalLitres}L</span>
                    <span class="data-tag-lbl">Litres</span>
                </div>
                <div class="data-tag">
                    <span class="data-tag-val">${formatCurrency(r.totals.totalAmount)}</span>
                    <span class="data-tag-lbl">Bill</span>
                </div>
                ${((period === 'month' && isPastMonth) || (period === 'year' && y < now.getFullYear())) ? `
                <button class="report-status-badge ${statusClass}" 
                    data-pay-id="${r.id}" 
                    data-pay-name="${r.name}" 
                    data-pay-outstanding="${r.outstanding.toFixed(0)}" 
                    data-pay-paid="${isPaid ? 1 : 0}">
                    ${isPaid ? 'Collected' : 'Pending'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
                ` : ''}
            </div>
        </div>
      </div>`;
        }).join('');

        attachReportListeners(list);
        updateReportUI();

    } catch (e) { console.error(e); }
}

function getReportDateRange(period) {
    const d = new Date(state.reportDate);
    const start = new Date(d);
    const end = new Date(d);

    switch (period) {
        case 'daily':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'week':
            // Show last 7 days ending at reportDate
            start.setDate(d.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'year':
            const y = state.reportYear;
            return {
                start: `${y}-01-01`,
                end: `${y}-12-31`
            };
        case 'custom':
            return {
                start: $('reportDateStart').value || dateToString(new Date()),
                end: $('reportDateEnd').value || dateToString(new Date())
            };
        case 'month':
        default:
            const m = state.reportMonth;
            const yr = state.reportYear;
            return {
                start: `${yr}-${String(m).padStart(2, '0')}-01`,
                end: `${yr}-${String(m).padStart(2, '0')}-${getDaysInMonth(m, yr)}`
            };
    }
    return { start: dateToString(start), end: dateToString(end) };
}

async function getRangeRecords(custId, start, end) {
    // Basic implementation: fetch all for involved months
    const sDate = new Date(start);
    const eDate = new Date(end);
    let records = [];

    // Simple loop for each month between start and end
    for (let y = sDate.getFullYear(); y <= eDate.getFullYear(); y++) {
        let startM = y === sDate.getFullYear() ? sDate.getMonth() + 1 : 1;
        let endM = y === eDate.getFullYear() ? eDate.getMonth() + 1 : 12;

        for (let m = startM; m <= endM; m++) {
            const monthRecs = await getDailyRecords(custId, y, m).catch(() => []);
            records = [...records, ...monthRecs];
        }
    }
    return records.filter(r => r.date >= start && r.date <= end);
}

async function getRangePayments(custId, start, end) {
    const sDate = new Date(start);
    const eDate = new Date(end);
    let payments = [];

    for (let y = sDate.getFullYear(); y <= eDate.getFullYear(); y++) {
        let startM = y === sDate.getFullYear() ? sDate.getMonth() + 1 : 1;
        let endM = y === eDate.getFullYear() ? eDate.getMonth() + 1 : 12;

        for (let m = startM; m <= endM; m++) {
            const monthPays = await getPayments(custId, y, m).catch(() => []);
            payments = [...payments, ...monthPays];
        }
    }
    return payments.filter(p => {
        const d = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.date || p.created_at);
        const dStr = dateToString(d);
        return dStr >= start && dStr <= end;
    });
}

function attachReportListeners(list) {
    list.querySelectorAll('.report-row').forEach(row => {
        const id = row.dataset.id;
        let longPressTimer = null;
        let isLongPress = false;

        const startLongPress = () => {
            isLongPress = false;
            row.classList.add('is-pressing');
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                row.classList.remove('is-pressing');
                // Toggle Selection
                if (state.reportSelections.has(id)) state.reportSelections.delete(id);
                else state.reportSelections.add(id);

                row.classList.toggle('is-selected');
                navigator.vibrate?.(50);
                updateReportUI();
            }, 600);
        };

        const cancelLongPress = () => {
            clearTimeout(longPressTimer);
            row.classList.remove('is-pressing');
        };

        // Long Press Events
        row.addEventListener('touchstart', startLongPress, { passive: true });
        row.addEventListener('touchend', cancelLongPress);
        row.addEventListener('touchmove', cancelLongPress, { passive: true });
        row.addEventListener('mousedown', startLongPress);
        row.addEventListener('mouseup', cancelLongPress);
        row.addEventListener('mouseleave', cancelLongPress);

        // Click Logic
        row.addEventListener('click', (e) => {
            if (isLongPress) { isLongPress = false; return; }

            // Easy selection if already in selection mode
            if (state.reportSelections.size > 0) {
                if (state.reportSelections.has(id)) {
                    state.reportSelections.delete(id);
                    row.classList.remove('is-selected');
                } else {
                    state.reportSelections.add(id);
                    row.classList.add('is-selected');
                }
                updateReportUI();
                return;
            }

            // Standard Action: Status Update (Collect/Undo)
            const statusBtn = e.target.closest('.report-status-badge');
            if (statusBtn) {
                e.stopPropagation();
                showQuickPaySheet({
                    id: statusBtn.dataset.payId,
                    name: statusBtn.dataset.payName,
                    outstanding: statusBtn.dataset.payOutstanding,
                    paid: statusBtn.dataset.payPaid
                });
                return;
            }

            // Standard Action: Call
            const callBtn = e.target.closest('.report-mini-call');
            if (callBtn) {
                e.stopPropagation();
                if (callBtn.dataset.phone) window.location.href = `tel:${callBtn.dataset.phone}`;
                else toast('No phone number', 'error');
                return;
            }

            // Standard Action: Open View
            openCustomerView(id);
        });
    });
}

function updateReportUI() {
    const selCount = state.reportSelections.size;
    $('selectionStatus').textContent = `${selCount} Selected`;
    $('bulkActionsBar').style.display = selCount > 0 ? 'flex' : 'none';
    $('reportSelectAll').checked = selCount > 0 && selCount === state.customers.length;

    // Toggle selection mode class on root page for CSS logic
    $('page-reports').classList.toggle('is-selection-mode', selCount > 0);
}

// Bulk Action Handlers
$('reportSelectAll').addEventListener('change', (e) => {
    if (e.target.checked) state.customers.forEach(c => state.reportSelections.add(c.id));
    else state.reportSelections.clear();
    loadReportsPage(); // Refresh list to show checkboxes
});

$('bulkCancel').addEventListener('click', () => {
    state.reportSelections.clear();
    loadReportsPage();
});

$('bulkGeneratePdf').addEventListener('click', async () => {
    const selectedData = state.lastReportData.filter(d => state.reportSelections.has(d.id));
    const range = getReportDateRange(state.reportPeriod);
    const label = state.reportPeriod === 'month' ? `${getMonthName(state.reportMonth)} ${state.reportYear}` : `${range.start} to ${range.end}`;

    toast(`Generating ${selectedData.length} PDFs...`, 'info');

    for (const d of selectedData) {
        await generateIndividualPDF(d, d.records, {
            periodLabel: label,
            rate: state.settings.rate,
            dateRange: range,
            paymentQr: state.paymentQr,
            businessName: state.settings.businessName,
            address: state.settings.address
        });
    }
    toast('PDFs generated ✓', 'success');
});

$('bulkWhatsApp').addEventListener('click', async () => {
    const selectedData = state.lastReportData.filter(d => state.reportSelections.has(d.id));
    toast(`Opening WhatsApp for ${selectedData.length} chats...`, 'info');

    for (const d of selectedData) {
        const text = await buildReportTextForData(d);
        const phone = (d.phone || '').replace(/\D/g, '');
        const fullPhone = phone.length === 10 ? '91' + phone : phone;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
        // Small delay to allow consecutive windows
        await new Promise(r => setTimeout(r, 600));
    }
});


async function buildReportTextForData(d) {
    const range = getReportDateRange(state.reportPeriod);
    const biz = state.settings.businessName || 'MilkBook';

    let text = `📦 *${biz} Delivery Report*\n\n`;
    text += `👤 *Customer:* ${d.name}\n`;
    text += `📅 *Period:* ${range.start} to ${range.end}\n`;
    text += `──────────────────\n`;
    text += `🥛 *Total Qty:* ${d.totals.totalLitres}L\n`;
    text += `💰 *Bill Amount:* ${formatCurrency(d.totals.totalAmount)}\n`;
    text += `✅ *Paid:* ${formatCurrency(d.paidAmt)}\n`;
    text += `🚩 *Outstanding:* ${formatCurrency(d.outstanding)}\n`;
    text += `──────────────────\n`;
    text += `_Sent via MilkBook Smart Management_`;
    return text;
}

/* ─── Quick Pay Sheet (from Reports) ──────────────────────── */
function showQuickPaySheet({ id, name, outstanding, paid }) {
    // Remove any existing sheet
    document.getElementById('quickPaySheet')?.remove();

    const isPaid = paid === '1' || Number(outstanding) <= 0;
    const amount = Number(outstanding);

    const sheet = document.createElement('div');
    sheet.id = 'quickPaySheet';
    sheet.className = 'quick-pay-overlay';
    sheet.innerHTML = `
        <div class="quick-pay-sheet">
            <div class="quick-pay-handle"></div>
            <div class="quick-pay-title">${name}</div>
            ${isPaid ? `
                <div class="quick-pay-paid-msg">✅ Payment collected this month</div>
                <button class="btn quick-pay-undo-btn" id="qpUndoBtn">↩ Mark as Not Collected</button>
                <button class="btn btn-secondary quick-pay-close-btn">Cancel</button>
            ` : `
                <div class="quick-pay-amount-row">
                    <span class="quick-pay-lbl">Outstanding</span>
                    <span class="quick-pay-amt">${formatCurrency(amount)}</span>
                </div>
                <button class="btn btn-primary quick-pay-confirm-btn" id="qpConfirmBtn">
                    ✅ Mark as Collected
                </button>
                <button class="btn btn-secondary quick-pay-close-btn">Cancel</button>
            `}
        </div>`;

    document.body.appendChild(sheet);

    // Close on backdrop tap
    sheet.addEventListener('click', (e) => {
        if (e.target === sheet) sheet.remove();
    });
    sheet.querySelectorAll('.quick-pay-close-btn').forEach(b =>
        b.addEventListener('click', () => sheet.remove())
    );

    // Confirm: mark as collected
    const confirmBtn = sheet.querySelector('#qpConfirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Saving…';
            try {
                const { reportMonth: m, reportYear: y } = state;
                await recordPayment(id, {
                    amount,
                    month: m,
                    year: y,
                    method: 'cash',
                    note: 'Marked collected from Reports',
                    date: new Date().toISOString().slice(0, 10),
                });
                sheet.remove();
                toast(`✅ ${name} marked as Collected`, 'success');
                await loadReportsPage();
            } catch (err) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '✅ Mark as Collected';
                toast('Failed to save payment', 'error');
            }
        });
    }

    // Undo: mark as NOT collected (delete this month's payments)
    const undoBtn = sheet.querySelector('#qpUndoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', async () => {
            undoBtn.disabled = true;
            undoBtn.textContent = 'Removing…';
            try {
                const { reportMonth: m, reportYear: y } = state;
                await deleteMonthPayments(id, y, m);
                sheet.remove();
                toast(`↩ ${name} marked as Not Collected`, 'info');
                await loadReportsPage();
            } catch (err) {
                undoBtn.disabled = false;
                undoBtn.textContent = '↩ Mark as Not Collected';
                toast('Failed to remove payment', 'error');
            }
        });
    }
}

/* ═══════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════ */
async function saveRate() {
    const rate = parseFloat($('rateInput').value);
    if (!rate || rate <= 0) { toast('Enter a valid rate', 'error'); return; }
    state.settings.rate = rate;
    await saveSettings({ ...state.settings, rate });
    toast(`Rate updated to ${formatCurrency(rate)}/L ✓`, 'success');
}

async function saveBusinessInfo() {
    const name = $('businessNameInput').value.trim();
    const address = $('addressInput').value.trim();
    state.settings.businessName = name || 'MilkBook';
    state.settings.address = address;
    state.settings.paymentQr = state.paymentQr;
    await saveSettings({ ...state.settings });
    toast('Business info saved ✓', 'success');
}

function updateQrUI() {
    const preview = $('qrPreview');
    const removeBtn = $('qrRemoveBtn');
    if (!preview) return;

    if (state.paymentQr) {
        preview.innerHTML = `<img src="${state.paymentQr}" class="qr-preview-img" />`;
        removeBtn.classList.remove('hidden');
    } else {
        preview.innerHTML = `
            <div class="qr-placeholder">
                <span>No QR selected</span>
                <button class="qr-upload-trigger" id="qrUploadBtn">Upload QR</button>
            </div>`;
        removeBtn.classList.add('hidden');
        // Re-wire upload button because we just replaced the innerHTML
        $('qrUploadBtn')?.addEventListener('click', () => $('qrFileInput').click());
    }
}

/* ═══════════════════════════════════════════
   CUSTOMER MODAL
═══════════════════════════════════════════ */
let editingCustomerId = null;

function openAddCustomer() {
    editingCustomerId = null;
    $('customerModalTitle').textContent = 'Add Customer';
    $('custNameInput').value = '';
    $('custPhoneInput').value = '';
    $('custAddrInput').value = '';
    $('custDefaultQty').value = '';
    $('deleteCustomerModalBtn').classList.add('hidden');
    openModal('customerModal');
}

function openEditCustomer(cust) {
    editingCustomerId = cust.id;
    $('customerModalTitle').textContent = 'Edit Customer';
    $('custNameInput').value = cust.name || '';
    $('custPhoneInput').value = cust.phone || '';
    $('custAddrInput').value = cust.address || '';
    $('custDefaultQty').value = cust.default_qty || '';
    $('deleteCustomerModalBtn').classList.remove('hidden');
    openModal('customerModal');
}

async function saveCustomerAction() {
    const name = $('custNameInput').value.trim();
    const phone = $('custPhoneInput').value.trim();
    const addr = $('custAddrInput').value.trim();
    const defQty = parseFloat($('custDefaultQty').value) || 0;
    if (!name) { toast('Enter customer name', 'error'); return; }

    const btn = $('saveCustomerBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span>`;

    try {
        await saveCustomer({ id: editingCustomerId, name, phone, address: addr, default_qty: defQty });
        closeModal('customerModal');
        toast(editingCustomerId ? 'Customer updated ✓' : 'Customer added ✓', 'success');
        await loadDashboard();
    } catch (err) {
        toast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Customer';
    }
}

async function deleteCurrentCustomer() {
    if (!editingCustomerId) return;
    if (!confirm('Delete this customer? All their data will be removed.')) return;
    await deleteCustomer(editingCustomerId).catch(console.error);
    closeModal('customerModal');
    await loadDashboard();
    toast('Customer deleted', 'success');
}

/* ═══════════════════════════════════════════
   PRINT PDF
═══════════════════════════════════════════ */
async function printInvoice() {
    const cust = state.currentCustomer;
    if (!cust) return;
    const { currentMonth: m, currentYear: y, settings } = state;
    const records = await getDailyRecords(cust.id, y, m).catch(() => []);
    const payments = await getPayments(cust.id, y, m).catch(() => []);
    const paidAmt = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totals = calcMonthlyTotals(records, settings.rate);
    const dayCount = getDaysInMonth(m, y);
    const dateRows = [];

    for (let d = 1; d <= dayCount; d++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const rec = records.find(r => r.date === dateStr);

        if (rec && !rec.no_delivery) {
            let coll = [];
            if (rec.morning_qty > 0) coll.push(rec.morning_collected !== false ? '✓' : '—');
            if (rec.evening_qty > 0) coll.push(rec.evening_collected !== false ? '✓' : '—');

            dateRows.push(`<tr>
                <td>${dateStr}</td>
                <td>${rec.morning_qty || 0} L</td>
                <td>${rec.evening_qty || 0} L</td>
                <td>${rec.total_litres} L</td>
                <td>${formatCurrency(rec.daily_amount)}</td>
                <td style="text-align:center;">${coll.join(' / ')}</td>
            </tr>`);
        } else {
            dateRows.push(`<tr>
                <td>${dateStr}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>`);
        }
    }

    $('printCustName').textContent = cust.name;
    $('printCustPhone').textContent = cust.phone || '—';
    $('printCustAddr').textContent = cust.address || '—';
    $('printPeriod').textContent = `${getMonthName(m)} ${y}`;
    $('printDate').textContent = formatDate(new Date(), 'entry');
    $('printRate').textContent = `${formatCurrency(settings.rate)}/L`;
    $('printTotalLitres').textContent = `${totals.totalLitres} L`;
    $('printTotalAmt').textContent = formatCurrency(totals.totalAmount);
    $('printInvoiceId').textContent = `Invoice #${y}${String(m).padStart(2, '0')}-${cust.id?.slice(-4) || '0000'}`;

    $('printTableBody').innerHTML = dateRows.join('');

    if (settings.address) {
        $('printPaymentInfo').innerHTML = `📍 Address: <strong>${settings.address}</strong>`;
        $('printPaymentInfo').classList.remove('hidden');
    } else {
        $('printPaymentInfo').classList.add('hidden');
    }
    $('printFooter').textContent = `Thank you, ${cust.name}! | ${settings.businessName || 'MilkBook'} | Generated ${formatDate(new Date(), 'entry')}`;

    // Handle Payment QR
    const qrWrap = $('printQrWrap');
    if (settings.paymentQr) {
        $('printQrImg').src = settings.paymentQr;
        qrWrap.classList.remove('hidden');
    } else {
        qrWrap.classList.add('hidden');
    }

    window.print();
}

/** Wire events for the QR Code setup */
function wireQrEvents() {
    $('qrUploadBtn')?.addEventListener('click', () => $('qrFileInput').click());
    $('qrRemoveBtn')?.addEventListener('click', () => {
        state.paymentQr = null;
        updateQrUI();
    });

    let cropperInstance = null;

    $('qrFileInput')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const cropModal = $('cropModal');
            const cropImage = $('cropImage');

            cropModal.classList.remove('hidden');
            cropImage.src = evt.target.result;

            // Wait for the image to load before initializing Cropper
            cropImage.onload = () => {
                if (cropperInstance) {
                    cropperInstance.destroy();
                }

                cropperInstance = new Cropper(cropImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    background: false
                });
            };
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // allow picking same file again
    });

    $('cancelCropBtn')?.addEventListener('click', () => {
        $('cropModal').classList.add('hidden');
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
    });

    $('confirmCropBtn')?.addEventListener('click', () => {
        if (!cropperInstance) return;

        const canvas = cropperInstance.getCroppedCanvas({
            width: 512,
            height: 512,
        });

        state.paymentQr = canvas.toDataURL('image/png', 0.9);
        updateQrUI();

        $('cropModal').classList.add('hidden');
        cropperInstance.destroy();
        cropperInstance = null;
    });
}

/* ═══════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════ */
function wireEvents() {
    wireQrEvents();

    // ── Customer Portal ──
    /*
    $('portalLogoutBtn')?.addEventListener('click', async () => {
        // ...
    });
    */
    $('portalPrevMonth')?.addEventListener('click', () => {
        const { m, y } = getPrevMonth(state.portalMonth, state.portalYear);
        state.portalMonth = m; state.portalYear = y;
        loadPortalMonth();
    });
    $('portalNextMonth')?.addEventListener('click', () => {
        const { m, y } = getNextMonth(state.portalMonth, state.portalYear);
        state.portalMonth = m; state.portalYear = y;
        loadPortalMonth();
    });

    // ── Dashboard ──
    $('addCustomerHeaderBtn')?.addEventListener('click', openAddCustomer);
    $('dashSettingsBtn')?.addEventListener('click', () => { showPage('page-settings'); resetSettingsNav(); });

    $('customerSearch')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = state.customers.filter(c =>
            c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
        renderCustomerList(filtered);
    });

    // ── Dashboard Hero Controls ──
    $('dashPrevDay')?.addEventListener('click', () => {
        state.dashDate.setDate(state.dashDate.getDate() - 1);
        loadDashboard();
    });
    $('dashNextDay')?.addEventListener('click', () => {
        state.dashDate.setDate(state.dashDate.getDate() + 1);
        loadDashboard();
    });
    $('dashSessionToggle')?.addEventListener('click', e => {
        const btn = e.target.closest('.session-btn');
        if (!btn) return;
        state.dashSession = btn.dataset.session;
        document.querySelectorAll('.session-btn').forEach(b => b.classList.toggle('active', b === btn));
        loadDashboard();
    });

    // ── Bottom Navs ──
    ['navDashboard', 'navDashboard2', 'navDashboard3'].forEach(id =>
        $(id)?.addEventListener('click', loadDashboard));
    ['navReports', 'navReports2', 'navReports3'].forEach(id =>
        $(id)?.addEventListener('click', loadReportsPage));
    ['navSettings', 'navSettings2', 'navSettings3'].forEach(id =>
        $(id)?.addEventListener('click', () => {
            showPage('page-settings');
            resetSettingsNav();
        }));

    // ── Entry Page ──
    $('entryBackBtn')?.addEventListener('click', loadDashboard);
    $('entryPrevDay')?.addEventListener('click', () => {
        state.entryDate.setDate(state.entryDate.getDate() - 1);
        renderEntryDate();
        loadEntryForDate();
    });
    $('entryNextDay')?.addEventListener('click', () => {
        state.entryDate.setDate(state.entryDate.getDate() + 1);
        renderEntryDate();
        loadEntryForDate();
    });
    const handleSessionSwitch = e => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        state.entrySession = btn.dataset.session;
        updateEntrySessionUI();
    };
    $('entrySessionToggleM')?.addEventListener('click', handleSessionSwitch);
    $('entrySessionToggleE')?.addEventListener('click', handleSessionSwitch);
    $('entryCalendarBtn')?.addEventListener('click', () =>
        $('entryDatePicker').showPicker?.() || $('entryDatePicker').click());
    $('entryDatePicker')?.addEventListener('change', e => {
        state.entryDate = new Date(e.target.value + 'T00:00:00');
        renderEntryDate(); loadEntryForDate();
    });

    // Auto-save triggers
    ['morningQty', 'eveningQty'].forEach(id => {
        $(id)?.addEventListener('input', () => { updateLiveTotal(); scheduleAutoSave(); });
    });
    ['morningCollected', 'eveningCollected'].forEach(id => {
        $(id)?.addEventListener('change', scheduleAutoSave);
    });


    $('saveEntryBtn')?.addEventListener('click', saveEntry);

    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const op = btn.dataset.op;
            const inp = $(field + 'Qty');
            let val = parseFloat(inp.value) || 0;
            val = op === 'plus' ? Math.min(20, val + 0.25) : Math.max(0, val - 0.25);
            inp.value = val;
            updateLiveTotal();
            scheduleAutoSave();
        });
    });

    $('historyPeriodToggle')?.addEventListener('click', e => {
        const btn = e.target.closest('.history-period-btn');
        if (!btn) return;
        state.historyPeriod = btn.dataset.period;
        document.querySelectorAll('.history-period-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderEntryHistory();
    });

    // ── Customer View ──
    $('customerBackBtn')?.addEventListener('click', loadDashboard);
    $('customerCalendarBtn')?.addEventListener('click', () =>
        $('customerMonthPicker').showPicker?.() || $('customerMonthPicker').click());
    $('customerMonthPicker')?.addEventListener('change', e => {
        const val = e.target.value; // "YYYY-MM"
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        state.currentYear = y;
        state.currentMonth = m;
        loadCustomerMonth();
    });
    $('prevMonth')?.addEventListener('click', () => {
        const { m, y } = getPrevMonth(state.currentMonth, state.currentYear);
        state.currentMonth = m; state.currentYear = y;
        loadCustomerMonth();
    });
    $('nextMonth')?.addEventListener('click', () => {
        const { m, y } = getNextMonth(state.currentMonth, state.currentYear);
        state.currentMonth = m; state.currentYear = y;
        loadCustomerMonth();
    });
    $('addEntryBtn')?.addEventListener('click', () => {
        if (state.currentCustomer) openEntryPage(state.currentCustomer.id);
    });
    $('editCustomerBtn')?.addEventListener('click', () => {
        if (state.currentCustomer) openEditCustomer(state.currentCustomer);
    });
    $('downloadCsvBtn')?.addEventListener('click', async () => {
        const cust = state.currentCustomer;
        const records = await getDailyRecords(cust.id, state.currentYear, state.currentMonth).catch(() => []);
        downloadCustomerCSV(cust, records, state.currentMonth, state.currentYear, state.settings.rate);
    });
    $('printInvoiceBtn')?.addEventListener('click', printInvoice);
    $('recordPaymentBtn')?.addEventListener('click', () => {
        const cust = state.currentCustomer;
        if (!cust) return;
        $('paymentModalDesc').textContent = `Recording payment for ${cust.name}`;
        openModal('paymentModal');
    });
    $('confirmPaymentBtn')?.addEventListener('click', confirmPayment);
    $('cancelPaymentBtn')?.addEventListener('click', () => closeModal('paymentModal'));

    // ── Report modal ──
    $('openReportSendBtn')?.addEventListener('click', () => openModal('reportSendModal'));
    $('cancelReportSendBtn')?.addEventListener('click', () => closeModal('reportSendModal'));
    $('sendWhatsAppBtn')?.addEventListener('click', () => sendWhatsApp(getSelectedReportType()));
    $('copyReportBtn')?.addEventListener('click', () => copyReport(getSelectedReportType()));

    // ── Settings ──
    $('saveRateBtn')?.addEventListener('click', saveRate);
    $('saveBusinessBtn')?.addEventListener('click', saveBusinessInfo);
    /*
    $('logoutBtn')?.addEventListener('click', async () => {
        await signOut();
        showPage('page-login');
    });
    */

    $('manualPushBtn')?.addEventListener('click', manualPushToFirebase);

    // Rate stepper +/−
    $('rateIncBtn')?.addEventListener('click', () => {
        const inp = $('rateInput');
        if (inp) inp.value = Math.min(500, (parseFloat(inp.value) || 0) + 1);
    });
    $('rateDecBtn')?.addEventListener('click', () => {
        const inp = $('rateInput');
        if (inp) inp.value = Math.max(1, (parseFloat(inp.value) || 0) - 1);
    });

    // ── Settings Navigator ──
    initSettingsNav();

    // ── Security: PIN Lock ──
    initPinLock();

    // ── Appearance: Theme ──
    initThemePicker();

    // ── Admin Management ──
    initAdminManager();

    // ── Drive Sync ──
    $('syncDriveBtn')?.addEventListener('click', async () => {
        const btn = $('syncDriveBtn');
        const status = $('syncStatus');
        const oldTxt = btn.innerText;

        try {
            btn.innerText = '⏳ Syncing...';
            btn.disabled = true;

            const { getLocalData } = await import('./db.js');
            const { syncToDrive } = await import('./drive-sync.js');

            await syncToDrive(getLocalData());

            status.innerText = 'Last sync: Just now';
            status.style.color = '#16A34A'; // Success green
            showToast('✅ Backed up to Google Drive!');
        } catch (err) {
            console.error(err);
            showToast('❌ Drive sync failed: ' + (err.error || 'User cancelled'));
        } finally {
            btn.innerText = oldTxt;
            btn.disabled = false;
        }
    });

    // ── Customer Modal ──
    $('saveCustomerBtn')?.addEventListener('click', saveCustomerAction);
    $('cancelCustomerBtn')?.addEventListener('click', () => closeModal('customerModal'));
    $('deleteCustomerModalBtn')?.addEventListener('click', deleteCurrentCustomer);

    // ── Reports page ──
    $('reportCalendarMainBtn')?.addEventListener('click', () =>
        $('reportMonthPicker').showPicker?.() || $('reportMonthPicker').click());
    $('reportMonthPicker')?.addEventListener('change', e => {
        const val = e.target.value;
        if (!val) return;
        if (state.reportPeriod === 'daily' || state.reportPeriod === 'week') {
            state.reportDate = new Date(val + 'T00:00:00');
            state.reportMonth = state.reportDate.getMonth() + 1;
            state.reportYear = state.reportDate.getFullYear();
        } else if (state.reportPeriod === 'year') {
            state.reportYear = parseInt(val);
        } else {
            const [y, m] = val.split('-').map(Number);
            state.reportYear = y; state.reportMonth = m;
        }
        loadReportsPage();
    });

    const shiftReportPeriod = (dir) => {
        const { reportPeriod: p, reportDate: d, reportMonth: m, reportYear: y } = state;
        if (p === 'daily') {
            d.setDate(d.getDate() + dir);
            state.reportMonth = d.getMonth() + 1;
            state.reportYear = d.getFullYear();
        } else if (p === 'week') {
            d.setDate(d.getDate() + (dir * 7));
            state.reportMonth = d.getMonth() + 1;
            state.reportYear = d.getFullYear();
        } else if (p === 'year') {
            state.reportYear += dir;
        } else {
            const res = dir > 0 ? getNextMonth(m, y) : getPrevMonth(m, y);
            state.reportMonth = res.m; state.reportYear = res.y;
            state.reportDate.setFullYear(res.y, res.m - 1, 1);
        }
        loadReportsPage();
    };

    $('reportPrevMonth')?.addEventListener('click', () => shiftReportPeriod(-1));
    $('reportNextMonth')?.addEventListener('click', () => shiftReportPeriod(1));
    $('reportPeriodToggle')?.addEventListener('click', e => {
        const btn = e.target.closest('.report-period-btn');
        if (!btn) return;
        state.reportPeriod = btn.dataset.period;
        $('reportCustomRangeBar').style.display = (state.reportPeriod === 'custom') ? 'flex' : 'none';
        loadReportsPage();
    });
    $('reportDateStart')?.addEventListener('change', loadReportsPage);
    $('reportDateEnd')?.addEventListener('change', loadReportsPage);



    // Modal backdrop close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    });
}


/* ═══════════════════════════════════════════
   SECURITY — PIN LOCK
═══════════════════════════════════════════ */
function initPinLock() {
    const PIN_KEY = 'milkbook_pin';
    const LOCK_KEY = 'milkbook_pin_enabled';

    let currentEntry = '';
    let lockEnabled = localStorage.getItem(LOCK_KEY) === '1';
    const savedPin = () => localStorage.getItem(PIN_KEY) || '';

    // ── Toggle switch state ──
    const toggle = document.getElementById('pinLockToggle');
    if (toggle) {
        toggle.checked = lockEnabled;
        toggle.addEventListener('change', () => {
            lockEnabled = toggle.checked;
            localStorage.setItem(LOCK_KEY, lockEnabled ? '1' : '0');
            updateHomeRowDesc();
            toast(lockEnabled ? '🔒 PIN lock enabled' : '🔓 PIN lock disabled');
        });
    }

    // ── PIN Pad ──
    document.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentEntry.length >= 4) return;
            currentEntry += btn.dataset.digit;
            refreshDots();
        });
    });

    document.getElementById('pinDelBtn')?.addEventListener('click', () => {
        currentEntry = currentEntry.slice(0, -1);
        refreshDots();
    });

    document.getElementById('savePinBtn')?.addEventListener('click', () => {
        if (currentEntry.length < 4) {
            setHint('Enter all 4 digits first', 'danger'); return;
        }
        localStorage.setItem(PIN_KEY, currentEntry);
        localStorage.setItem(LOCK_KEY, '1');
        if (toggle) { toggle.checked = true; lockEnabled = true; }
        setHint('✓ PIN saved!', 'success');
        currentEntry = '';
        refreshDots();
        updateHomeRowDesc();
        toast('🔒 PIN saved — app is now locked on startup');
    });

    document.getElementById('clearPinBtn')?.addEventListener('click', () => {
        localStorage.removeItem(PIN_KEY);
        localStorage.setItem(LOCK_KEY, '0');
        lockEnabled = false;
        if (toggle) toggle.checked = false;
        currentEntry = '';
        refreshDots();
        setHint('PIN cleared — lock disabled', 'danger');
        updateHomeRowDesc();
        toast('🔓 PIN removed');
    });

    function refreshDots() {
        for (let i = 0; i < 4; i++) {
            const d = document.getElementById('d' + i);
            if (!d) continue;
            d.classList.toggle('filled', i < currentEntry.length);
            d.classList.remove('error');
        }
    }

    function setHint(msg, cls = '') {
        const h = document.getElementById('pinHint');
        if (!h) return;
        h.textContent = msg;
        h.className = 'pin-hint' + (cls ? ' ' + cls : '');
        if (cls) setTimeout(() => { h.textContent = 'Enter a 4-digit PIN'; h.className = 'pin-hint'; }, 2400);
    }

    function updateHomeRowDesc() {
        const el = document.getElementById('securityRowDesc');
        if (el) el.textContent = (localStorage.getItem(LOCK_KEY) === '1') ? '🔒 App lock on' : 'App lock disabled';
    }

    updateHomeRowDesc();

    // ── Lock Screen Overlay (shown on boot if PIN is set) ──
    function showLockScreen() {
        if (document.getElementById('pinLockOverlay')) return; // already shown
        let lockEntry = '';
        const overlay = document.createElement('div');
        overlay.id = 'pinLockOverlay';
        overlay.innerHTML = `
            <div class="pin-lock-screen">
                <div class="pin-lock-logo">🥛</div>
                <div class="pin-lock-title">MilkBook</div>
                <div class="pin-lock-sub">Enter your PIN to continue</div>
                <div class="pin-dots" style="margin-bottom:10px;">
                    <span class="pin-dot" id="ld0"></span>
                    <span class="pin-dot" id="ld1"></span>
                    <span class="pin-dot" id="ld2"></span>
                    <span class="pin-dot" id="ld3"></span>
                </div>
                <div class="pin-hint" id="lockHint" style="margin-bottom:18px;">&#8203;</div>
                <div class="pin-pad" style="width:220px;">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="pin-key lock-key" data-n="${n}">${n}</button>`).join('')}
                    <button class="pin-key pin-key--blank"></button>
                    <button class="pin-key lock-key" data-n="0">0</button>
                    <button class="pin-key pin-key--del" id="lockDel">⌫</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const refreshLock = () => {
            for (let i = 0; i < 4; i++) {
                const d = document.getElementById('ld' + i);
                if (d) d.classList.toggle('filled', i < lockEntry.length);
            }
        };

        overlay.querySelectorAll('.lock-key').forEach(btn => {
            btn.addEventListener('click', () => {
                if (lockEntry.length >= 4) return;
                lockEntry += btn.dataset.n;
                refreshLock();
                if (lockEntry.length === 4) {
                    if (lockEntry === savedPin()) {
                        overlay.style.animation = 'fadeOut 0.3s forwards';
                        setTimeout(() => overlay.remove(), 300);
                    } else {
                        for (let i = 0; i < 4; i++) {
                            const d = document.getElementById('ld' + i);
                            if (d) { d.classList.remove('filled'); d.classList.add('error'); }
                        }
                        const h = document.getElementById('lockHint');
                        if (h) { h.textContent = 'Wrong PIN — try again'; h.style.color = '#DC2626'; }
                        setTimeout(() => {
                            lockEntry = '';
                            refreshLock();
                            if (h) { h.textContent = '\u200B'; h.style.color = ''; }
                        }, 900);
                    }
                }
            });
        });

        document.getElementById('lockDel')?.addEventListener('click', () => {
            lockEntry = lockEntry.slice(0, -1);
            refreshLock();
        });
    }

    // Show on load if PIN is set
    if (localStorage.getItem(LOCK_KEY) === '1' && savedPin()) {
        showLockScreen();
    }
}


/* ═══════════════════════════════════════════
   APPEARANCE — THEME PICKER
═══════════════════════════════════════════ */
const THEMES = {
    royal: { name: 'Vibrant Indigo', grad: 'linear-gradient(135deg, #4338CA, #6366F1)', primary: '#6366F1', deeper: '#4338CA', light: '#EEF2FF', border: '#C7D2FE' },
    emerald: { name: 'Emerald Glow', grad: 'linear-gradient(135deg, #047857, #10B981)', primary: '#10B981', deeper: '#047857', light: '#ECFDF5', border: '#A7F3D0' },
    crimson: { name: 'Neon Crimson', grad: 'linear-gradient(135deg, #BE123C, #F43F5E)', primary: '#F43F5E', deeper: '#BE123C', light: '#FFE4E6', border: '#FECDD3' },
    violet: { name: 'Super Violet', grad: 'linear-gradient(135deg, #5B21B6, #8B5CF6)', primary: '#8B5CF6', deeper: '#5B21B6', light: '#F5F3FF', border: '#DDD6FE' },
    amber: { name: 'Electric Amber', grad: 'linear-gradient(135deg, #B45309, #F59E0B)', primary: '#F59E0B', deeper: '#B45309', light: '#FFFBEB', border: '#FDE68A' },
    dark: { name: 'Cyber Dark', grad: 'linear-gradient(135deg, #0F172A, #334155)', primary: '#94A3B8', deeper: '#0F172A', light: '#F1F5F9', border: '#CBD5E1' },
};
const THEME_KEY = 'milkbook_theme';

function applyTheme(key) {
    const t = THEMES[key];
    if (!t) return;
    const r = document.documentElement.style;
    r.setProperty('--primary', t.primary);
    r.setProperty('--primary-deeper', t.deeper);
    r.setProperty('--primary-light', t.light);
    r.setProperty('--primary-border', t.border);
    // Update gradient surfaces (header bars, etc.)
    document.querySelectorAll(
        '.settings-hero, .setnav-subheader, .page-header, .top-bar, .pin-lock-screen .pin-lock-logo'
    ).forEach(el => el.style.background = t.grad);
}

function initThemePicker() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'royal';
    applyTheme(savedTheme);

    // Mark active swatch on open
    document.querySelectorAll('.theme-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.theme === savedTheme);
    });

    // Update preview card
    const bar = document.getElementById('themePreviewBar');
    const title = document.getElementById('themePreviewTitle');
    const desc = document.getElementById('themeRowDesc');

    const updatePreview = key => {
        const t = THEMES[key];
        if (!t) return;
        if (bar) bar.style.background = t.grad;
        if (title) title.textContent = t.name;
        if (desc) desc.textContent = t.name + ' theme';
    };
    updatePreview(savedTheme);

    document.querySelectorAll('.theme-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            const key = sw.dataset.theme;
            document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            applyTheme(key);
            updatePreview(key);
            localStorage.setItem(THEME_KEY, key);
            toast('🎨 ' + THEMES[key].name + ' theme applied');
        });
    });
}


/* ═══════════════════════════════════════════
   ADMIN MANAGEMENT
═══════════════════════════════════════════ */
const ADMINS_KEY = 'milkbook_admins';

function getAdmins() {
    try { return JSON.parse(localStorage.getItem(ADMINS_KEY)) || []; }
    catch { return []; }
}

function saveAdmins(list) {
    localStorage.setItem(ADMINS_KEY, JSON.stringify(list));
}

function initAdminManager() {
    renderAdminList();

    // Update home row description
    const rowDesc = document.getElementById('adminRowDesc');
    const updateAdminDesc = () => {
        const n = getAdmins().length + 1; // +1 for primary admin
        if (rowDesc) rowDesc.textContent = n + ' admin account' + (n !== 1 ? 's' : '');
    };
    updateAdminDesc();

    document.getElementById('addAdminBtn')?.addEventListener('click', () => {
        const emailEl = document.getElementById('newAdminEmail');
        const nameEl = document.getElementById('newAdminName');
        const email = (emailEl?.value || '').trim().toLowerCase();
        const name = (nameEl?.value || '').trim();

        if (!email || !email.includes('@')) { toast('⚠️ Enter a valid email address', 'error'); return; }
        if (!name) { toast('⚠️ Enter a display name', 'error'); return; }

        const admins = getAdmins();
        if (admins.find(a => a.email === email)) { toast('⚠️ That admin already exists', 'error'); return; }

        admins.push({ id: Date.now(), name, email, addedAt: new Date().toLocaleDateString('en-IN') });
        saveAdmins(admins);
        if (emailEl) emailEl.value = '';
        if (nameEl) nameEl.value = '';
        renderAdminList();
        updateAdminDesc();
        toast('✅ ' + name + ' added as admin');
    });

    function renderAdminList() {
        const list = document.getElementById('adminList');
        if (!list) return;
        const admins = getAdmins();
        const currentUser = state.user;

        // Primary admin row (always first, cannot be removed)
        const primaryEmail = currentUser?.email || currentUser?.phoneNumber || 'Primary Account';
        const primaryName = state.settings?.businessName || 'Owner';
        let html = adminItemHTML({ name: primaryName, email: primaryEmail }, true);

        // Additional admins
        admins.forEach(a => { html += adminItemHTML(a, false); });

        list.innerHTML = html;

        // Wire remove buttons
        list.querySelectorAll('.admin-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.id);
                const upd = getAdmins().filter(a => a.id !== id);
                saveAdmins(upd);
                renderAdminList();
                updateAdminDesc();
                toast('🗑 Admin removed');
            });
        });
    }

    function adminItemHTML(a, isPrimary) {
        const initials = (a.name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        return `
        <div class="admin-item">
            <div class="admin-avatar">${initials}</div>
            <div class="admin-item-body">
                <div class="admin-item-name">${a.name}</div>
                <div class="admin-item-email">${a.email}</div>
            </div>
            ${isPrimary
                ? `<span class="admin-role-chip admin-role-chip--primary">Primary</span>`
                : `<span class="admin-role-chip admin-role-chip--secondary">Admin</span>
                   <button class="admin-remove-btn" data-id="${a.id}">Remove</button>`
            }
        </div>`;
    }
}


/* ═══════════════════════════════════════════
   SETTINGS NAVIGATOR
═══════════════════════════════════════════ */
function initSettingsNav() {
    const track = document.getElementById('setnavTrack');
    if (!track) return;

    /** Forward: tap a row → show that sub-page panel */
    document.querySelectorAll('.setnav-row[data-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            // Reorder panels so the chosen sub is the SECOND panel
            // (home stays first, target sub slides in second)
            const target = document.getElementById(targetId);
            if (!target) return;

            // Move the target panel to position right after home (2nd slot)
            const home = document.getElementById('setnav-home');
            if (home.nextSibling !== target) {
                track.insertBefore(target, home.nextSibling);
            }

            // Slide track left
            track.classList.add('at-sub');
        });
    });

    /** Back: slide track right → home */
    document.querySelectorAll('.setnav-back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            track.classList.remove('at-sub');
        });
    });
}

/** Reset the settings nav to the home screen instantly */
function resetSettingsNav() {
    const track = document.getElementById('setnavTrack');
    if (!track) return;
    // Disable transition for instant reset
    track.style.transition = 'none';
    track.classList.remove('at-sub');
    // Re-enable transition after a frame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            track.style.transition = '';
        });
    });
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
wireEvents();
boot();

