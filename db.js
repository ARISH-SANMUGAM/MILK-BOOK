/**
 * db.js — MilkBook v2.1
 * Robust Local + Firebase + Drive Sync System.
 * All writes go to Local (localStorage) AND Firestore (if available) instantly.
 */

// ─── Firebase refs ────────────────────────────────────────
function db() { return window.__FB?.db; }
function isDemoMode() { return !window.__FB || window.__FB.isDemoMode !== false; }

// ─── Local Mobile Storage (localStorage) ──────────────────
const LOCAL = {
    get() {
        try {
            const r = localStorage.getItem('milkbook_v2');
            return r ? JSON.parse(r) : { settings: { rate: 60, businessName: 'MilkBook', address: '' }, customers: {}, records: {}, payments: {} };
        } catch { return { settings: { rate: 60, businessName: 'MilkBook', address: '' }, customers: {}, records: {}, payments: {} }; }
    },
    save(s) { localStorage.setItem('milkbook_v2', JSON.stringify(s)); },
    monthBounds(year, month) {
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const last = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
        return { start, end };
    },
};

export function getLocalData() { return LOCAL.get(); }

// ─── Cloud Sync Helper (Google Drive) ─────────────────────
// Uses the user's Google account to store a backup file.
export async function syncToDrive() {
    // Note: Implementation requires Google Drive API loaded in window.
    // This function will be called from settings to "Keep everything safe".
    const state = LOCAL.get();
    const data = JSON.stringify(state, null, 2);
    console.log("Syncing to Drive...", data.length, "bytes");

    if (window.gapi && window.gapi.client && window.gapi.client.drive) {
        // Logic to upload/update 'milkbook_backup.json' in user's Drive
    }
}

// ─── Init ─────────────────────────────────────────────────
export async function initDB() {
    // Firestore handles its own offline persistence via indexedDB (setup in firebase-config.js)
}

// ─── Settings ─────────────────────────────────────────────
export async function getSettings() {
    if (isDemoMode()) return LOCAL.get().settings;
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(db(), 'settings', 'config'));
    return snap.exists() ? snap.data() : LOCAL.get().settings;
}

export async function saveSettings(data) {
    // 1. Save Locally
    const s = LOCAL.get();
    s.settings = { ...s.settings, ...data };
    LOCAL.save(s);

    // 2. Save to Firebase if not in demo
    if (!isDemoMode()) {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(db(), 'settings', 'config'), data, { merge: true });
    }
}

// ─── Customers ────────────────────────────────────────────
export async function getCustomers() {
    let list = [];
    if (isDemoMode()) {
        const s = LOCAL.get();
        list = Object.entries(s.customers).map(([id, d]) => ({ id, ...d }));
    } else {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const snap = await getDocs(collection(db(), 'customers'));
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Sync cloud data back to local storage so "Local Storage also" is always updated
        const s = LOCAL.get();
        list.forEach(c => {
            s.customers[c.id] = c;
        });
        LOCAL.save(s);
    }

    const activeList = [];
    const now = new Date().toISOString();

    for (const c of list) {
        if (c.marked_for_deletion && c.delete_scheduled_at) {
            if (now >= c.delete_scheduled_at) {
                // Time to physically delete
                await deleteCustomer(c.id).catch(err => console.error("Auto delete failed", err));
                continue; // don't add to returned list
            } else {
                // In the 15-day waiting period, hide from everywhere
                continue;
            }
        }
        activeList.push(c);
    }

    return activeList;
}

export async function getCustomer(id) {
    if (isDemoMode()) {
        const s = LOCAL.get();
        return s.customers[id] ? { id, ...s.customers[id] } : null;
    }
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(db(), 'customers', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveCustomer(data) {
    const { id, ...rest } = data;
    const payload = { ...rest, total_balance: rest.total_balance ?? 0 };

    // 1. Save Locally
    const s = LOCAL.get();
    const custId = id || ('cust_' + Date.now());
    s.customers[custId] = { ...(s.customers[custId] || {}), ...payload };
    LOCAL.save(s);

    // 2. Save to Firebase
    if (!isDemoMode()) {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        if (id) {
            await fs.updateDoc(fs.doc(db(), 'customers', id), payload);
        } else {
            const ref = await fs.addDoc(fs.collection(db(), 'customers'), payload);
            // Update local storage with the new Firebase ID
            const s2 = LOCAL.get();
            s2.customers[ref.id] = { ...payload };
            delete s2.customers[custId]; // Cleanup temp ID
            LOCAL.save(s2);
            return ref.id;
        }
    }
    return custId;
}

export async function deleteCustomer(id) {
    // 1. Delete Locally
    const s = LOCAL.get();
    delete s.customers[id];
    delete s.records[id];
    delete s.payments[id];
    LOCAL.save(s);

    // 2. Delete from Firebase
    if (!isDemoMode()) {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await deleteDoc(doc(db(), 'customers', id));
    }
}

// ─── Daily Records ────────────────────────────────────────
export async function saveDailyRecord(customerId, date, data) {
    // 1. Save Locally
    const s = LOCAL.get();
    if (!s.records[customerId]) s.records[customerId] = {};
    s.records[customerId][date] = { date, ...data };
    LOCAL.save(s);

    // 2. Save to Firebase
    if (!isDemoMode()) {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(db(), 'customers', customerId, 'daily_records', date), { date, ...data }, { merge: true });
    }

    // 3. Refresh the monthly payment history summary
    const [y, m] = date.split('-').map(Number);
    await updateMonthlyPaymentHistory(customerId, y, m).catch(console.error);
}

export async function getDailyRecord(customerId, date) {
    const s = LOCAL.get();
    const localRec = s.records?.[customerId]?.[date];
    if (isDemoMode()) return localRec || null;

    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(db(), 'customers', customerId, 'daily_records', date));
    return snap.exists() ? snap.data() : (localRec || null);
}

export async function getDailyRecords(customerId, year, month) {
    const { start, end } = LOCAL.monthBounds(year, month);
    if (isDemoMode()) {
        const s = LOCAL.get();
        const all = s.records?.[customerId] || {};
        return Object.values(all)
            .filter(r => r.date >= start && r.date <= end && !r.type)
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const q = fs.query(
        fs.collection(db(), 'customers', customerId, 'daily_records'),
        fs.where('date', '>=', start),
        fs.where('date', '<=', end),
        fs.orderBy('date', 'asc'),
    );
    const snap = await fs.getDocs(q);
    return snap.docs.map(d => d.data());
}

// ─── Payments ─────────────────────────────────────────────
export async function recordPayment(customerId, paymentData) {
    const { amount, month, year, method = 'cash', note = '', date } = paymentData;
    const payId = `pay_${Date.now()}`;

    // 1. Save Locally
    const s = LOCAL.get();
    if (!s.payments[customerId]) s.payments[customerId] = {};
    const payload = { id: payId, amount: parseFloat(amount), month, year, method, note, date };
    s.payments[customerId][payId] = payload;
    if (s.customers[customerId]) {
        s.customers[customerId].total_balance = (s.customers[customerId].total_balance || 0) - parseFloat(amount);
    }
    LOCAL.save(s);

    // 2. Save to Firebase
    if (!isDemoMode()) {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await fs.setDoc(fs.doc(db(), 'customers', customerId, 'payments', payId), payload);
        await fs.updateDoc(fs.doc(db(), 'customers', customerId), {
            total_balance: fs.increment(-parseFloat(amount)),
        });
    }

    // 3. Refresh the monthly payment history summary for the month the payment covers
    await updateMonthlyPaymentHistory(customerId, year, month).catch(console.error);

    return payId;
}


export async function getPayments(customerId, year, month) {
    if (isDemoMode()) {
        const s = LOCAL.get();
        const all = s.payments?.[customerId] || {};
        return Object.values(all).filter(p => {
            if (year && month) return p.year === year && p.month === month;
            return true;
        });
    }
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    let q = fs.collection(db(), 'customers', customerId, 'payments');
    if (year && month) {
        q = fs.query(q, fs.where('year', '==', year), fs.where('month', '==', month));
    }
    const snap = await fs.getDocs(q);
    return snap.docs.map(d => d.data());
}

// ─── Delete all payments for a given customer/month ────────
export async function deleteMonthPayments(customerId, year, month) {
    // 1. Delete Locally
    const s = LOCAL.get();
    if (s.payments?.[customerId]) {
        const all = s.payments[customerId];
        let removedTotal = 0;
        Object.entries(all).forEach(([id, p]) => {
            if (p.year === year && p.month === month) {
                removedTotal += parseFloat(p.amount || 0);
                delete all[id];
            }
        });
        // Reverse the balance adjustment
        if (s.customers[customerId]) {
            s.customers[customerId].total_balance =
                (s.customers[customerId].total_balance || 0) + removedTotal;
        }
        LOCAL.save(s);
    }

    // 2. Delete from Firebase
    if (!isDemoMode()) {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const q = fs.query(
            fs.collection(db(), 'customers', customerId, 'payments'),
            fs.where('year', '==', year),
            fs.where('month', '==', month)
        );
        const snap = await fs.getDocs(q);
        await Promise.all(snap.docs.map(d => fs.deleteDoc(d.ref)));
    }
}
// ─── Lifetime Stats ──────────────────────────────────────
export async function getLifetimeStats(customerId) {
    let allRecords = [], allPayments = [];

    if (isDemoMode()) {
        const s = LOCAL.get();
        allRecords = Object.values(s.records?.[customerId] || {});
        allPayments = Object.values(s.payments?.[customerId] || {});
    } else {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const rSnap = await fs.getDocs(fs.collection(db(), 'customers', customerId, 'daily_records'));
        const pSnap = await fs.getDocs(fs.collection(db(), 'customers', customerId, 'payments'));
        allRecords = rSnap.docs.map(d => d.data());
        allPayments = pSnap.docs.map(d => d.data());
    }

    const totalLitres = allRecords.reduce((s, r) => s + (parseFloat(r.total_litres) || 0), 0);
    const totalRevenue = allRecords.reduce((s, r) => s + (parseFloat(r.daily_amount) || 0), 0);
    const totalPaid = allPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    return { totalLitres, totalRevenue, totalPaid };
}

// ─── Balance Aggregates ──────────────────────────────────
/** Sum all delivery revenue and payments BEFORE a specific ISO date.
 *  Payments are filtered by their ATTRIBUTION month/year (not physical date),
 *  so a payment made today for last month's due correctly reduces prevBalance. */
export async function getAggregatesBeforeDate(customerId, beforeDate) {
    let allRecords = [], allPayments = [];

    // Parse beforeDate into year/month for attribution-based filtering
    const [beforeYear, beforeMonth] = beforeDate.split('-').map(Number);

    /** Returns true if a payment's attributed month/year is before the period */
    function isPaymentBeforePeriod(p) {
        if (p.year && p.month) {
            return p.year < beforeYear || (p.year === beforeYear && p.month < beforeMonth);
        }
        // Fallback: use physical date if year/month missing
        const d = p.date || p.created_at || '0000-00-00';
        return d < beforeDate;
    }

    if (isDemoMode()) {
        const s = LOCAL.get();
        allRecords = Object.values(s.records?.[customerId] || {}).filter(r => r.date < beforeDate);
        allPayments = Object.values(s.payments?.[customerId] || {}).filter(isPaymentBeforePeriod);
    } else {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

        // 1. Records before date (date-keyed, simple range query)
        const rQ = fs.query(
            fs.collection(db(), 'customers', customerId, 'daily_records'),
            fs.where('date', '<', beforeDate)
        );
        const rSnap = await fs.getDocs(rQ);
        allRecords = rSnap.docs.map(d => d.data());

        // 2. Fetch ALL payments and filter client-side by attribution month/year.
        //    This avoids composite Firestore indexes. Per-customer payment counts
        //    are small so this is fast and safe.
        const pSnap = await fs.getDocs(
            fs.collection(db(), 'customers', customerId, 'payments')
        );
        allPayments = pSnap.docs.map(d => d.data()).filter(isPaymentBeforePeriod);
    }

    const totalRevenue = allRecords.reduce((s, r) => s + (parseFloat(r.daily_amount) || 0), 0);
    const totalPaid = allPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    return { totalRevenue, totalPaid, balance: totalRevenue - totalPaid };
}



// ─── Monthly Payment History Summary ─────────────────────
/**
 * Compute and write/update a YYYY-MM summary document to:
 *   customers/{customerId}/paymentHistory/{YYYY-MM}
 *
 * Fields written:
 *   month, year, periodKey (YYYY-MM),
 *   milkQuantity, ratePerLiter, totalAmount,
 *   paidAmount, dueAmount,
 *   paymentMethod, lastPaymentDate, status
 */
export async function updateMonthlyPaymentHistory(customerId, year, month) {
    // Fetch daily records for the month
    const records = await getDailyRecords(customerId, year, month).catch(() => []);
    // Fetch payments for the month
    const payments = await getPayments(customerId, year, month).catch(() => []);

    const milkQuantity = records.reduce((s, r) => s + (parseFloat(r.total_litres) || 0), 0);
    // Use the rate stored on the most recent record, or fall back to 0
    const latestRecord = records.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const ratePerLiter = parseFloat(latestRecord?.rate_per_litre || 0);

    const totalAmount = records.reduce((s, r) => s + (parseFloat(r.daily_amount) || 0), 0);
    const paidAmount = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const dueAmount = Math.max(0, totalAmount - paidAmount);

    // Determine status
    let status = 'Due';
    if (dueAmount <= 0 && totalAmount > 0) status = 'Paid';
    else if (paidAmount > 0 && dueAmount > 0) status = 'Partially Paid';

    // Last payment info
    const lastPayment = payments.sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
    )[0];
    const paymentMethod = lastPayment?.method || null;
    const lastPaymentDate = lastPayment?.date || null;

    const periodKey = `${year}-${String(month).padStart(2, '0')}`;
    const summary = {
        periodKey,
        month,
        year,
        milkQuantity: parseFloat(milkQuantity.toFixed(2)),
        ratePerLiter,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        paidAmount: parseFloat(paidAmount.toFixed(2)),
        dueAmount: parseFloat(dueAmount.toFixed(2)),
        paymentMethod,
        lastPaymentDate,
        status,
        updatedAt: new Date().toISOString(),
    };

    // Save locally under a paymentHistory key
    const s = LOCAL.get();
    if (!s.paymentHistory) s.paymentHistory = {};
    if (!s.paymentHistory[customerId]) s.paymentHistory[customerId] = {};
    s.paymentHistory[customerId][periodKey] = summary;
    LOCAL.save(s);

    // Save to Firebase
    if (!isDemoMode()) {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(
            doc(db(), 'customers', customerId, 'paymentHistory', periodKey),
            summary,
            { merge: true }
        );
    }

    return summary;
}

/** Fetch a specific month's payment history summary */
export async function getMonthlyPaymentHistory(customerId, year, month) {
    const periodKey = `${year}-${String(month).padStart(2, '0')}`;

    if (isDemoMode()) {
        const s = LOCAL.get();
        return s.paymentHistory?.[customerId]?.[periodKey] || null;
    }

    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(db(), 'customers', customerId, 'paymentHistory', periodKey));
    return snap.exists() ? snap.data() : null;
}
