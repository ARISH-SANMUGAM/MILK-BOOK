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
export async function getCustomers(includeHidden = false) {
    let list = [];
    if (isDemoMode()) {
        const s = LOCAL.get();
        list = Object.entries(s.customers).map(([id, d]) => ({ id, ...d }));
    } else {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const snap = await fs.getDocs(fs.collection(db(), 'customers'));
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const s = LOCAL.get();
        const cloudIds = new Set(list.map(c => c.id));
        Object.keys(s.customers).forEach(id => {
            if (!cloudIds.has(id)) delete s.customers[id];
        });
        list.forEach(c => {
            s.customers[c.id] = c;
        });
        LOCAL.save(s);
    }

    const activeList = [];
    const now = new Date().toISOString();

    for (const c of list) {
        if (!includeHidden && c.marked_for_deletion && c.delete_scheduled_at) {
            if (now >= c.delete_scheduled_at) {
                // Background cleanup if expired
                deleteCustomer(c.id).catch(() => { });
                continue;
            }
            continue; // Hide from normal views
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
            await fs.setDoc(fs.doc(db(), 'customers', id), payload, { merge: true });
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
    if (s.records) delete s.records[id];
    if (s.payments) delete s.payments[id];
    if (s.monthlyRecords) delete s.monthlyRecords[id];
    LOCAL.save(s);

    // 2. Delete from Firebase
    if (!isDemoMode()) {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const customerDocRef = fs.doc(db(), 'customers', id);

        // Standard deleteDoc doesn't delete sub-collections. 
        // We attempt to clear known sub-collections to ensure doc is fully gone from console.
        const subCollections = ['payments', 'daily_records', 'monthly_records'];
        for (const sub of subCollections) {
            try {
                const snap = await fs.getDocs(fs.collection(customerDocRef, sub));
                const deletePromises = snap.docs.map(d => fs.deleteDoc(d.ref));
                await Promise.all(deletePromises);
            } catch (e) {
                console.warn(`Could not clear sub-collection ${sub} for ${id}:`, e);
            }
        }

        await fs.deleteDoc(customerDocRef);
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
        if (!customerId) throw new Error("Missing customer ID for payment");
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await fs.setDoc(fs.doc(db(), 'customers', customerId, 'payments', payId), payload);
        // Using setDoc with merge:true instead of updateDoc to prevent "No document to update" errors
        await fs.setDoc(fs.doc(db(), 'customers', customerId), {
            total_balance: fs.increment(-parseFloat(amount)),
        }, { merge: true });
    }

    // 3. Refresh the monthly summary for the month the payment covers
    // If the payment has a physical date, also update the summary for that month
    // since 'total_paid' in monthly_records is based on physical payment date.
    if (date) {
        const [py, pm] = date.split('-').map(Number);
        await updateMonthlySummary(customerId, py, pm).catch(console.error);

        // If the attribution month is different, also update that summary
        if (py !== year || pm !== month) {
            await updateMonthlySummary(customerId, year, month).catch(console.error);
        }
    } else {
        await updateMonthlySummary(customerId, year, month).catch(console.error);
    }

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
 *  Records use 'date' field. Payments now use 'date' field (physical date received).
 *  This gives the correct historical balance at any point in time. */
// ─── Monthly Summary Logic (Reconstructed) ────────────────
/**
 * Compute and write/update a YYYY-MM summary document to:
 *   customers/{customerId}/monthly_records/{YYYY-MM}
 */
export async function updateMonthlySummary(customerId, year, month) {
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const lastOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // 1. Fetch data
    const [records, allPayments] = await Promise.all([
        getDailyRecords(customerId, year, month).catch(() => []),
        getPayments(customerId).catch(() => [])
    ]);

    // 2. Calculations
    const total_litres = records.reduce((s, r) => s + (parseFloat(r.total_litres) || 0), 0);

    // Most recent rate in this month
    const latestRecord = records.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const rate_per_litre = parseFloat(latestRecord?.rate_per_litre || 0);

    const current_bill = Math.round(total_litres * rate_per_litre);

    // Payments ATTRIBUTED to this month/year
    const attributedPayments = allPayments.filter(p => p.month === month && p.year === year);
    const total_paid = attributedPayments.reduce((s, p) => s + (p.amount || 0), 0);

    const pending_balance = Math.max(0, current_bill - total_paid);
    const is_collected = total_paid >= current_bill && current_bill > 0;
    const status = is_collected ? 'paid' : (total_paid > 0 ? 'partial' : 'due');

    const periodKey = `${year}-${String(month).padStart(2, '0')}`;
    const summary = {
        periodKey,
        month,
        year,
        total_litres: parseFloat(total_litres.toFixed(2)),
        rate_per_litre,
        total_paid,
        current_bill,
        pending_balance,
        is_collected,
        status,
        daily_entries: records.sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: new Date().toISOString()
    };

    // Save locally
    const s = LOCAL.get();
    if (!s.monthlyRecords) s.monthlyRecords = {};
    if (!s.monthlyRecords[customerId]) s.monthlyRecords[customerId] = {};
    s.monthlyRecords[customerId][periodKey] = summary;
    LOCAL.save(s);

    // Save to Firebase
    if (!isDemoMode()) {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(
            doc(db(), 'customers', customerId, 'monthly_records', periodKey),
            summary,
            { merge: true }
        );
    }

    return summary;
}

/** Fetch a specific month's summary */
export async function getMonthlySummary(customerId, year, month) {
    const periodKey = `${year}-${String(month).padStart(2, '0')}`;

    if (isDemoMode()) {
        const s = LOCAL.get();
        return s.monthlyRecords?.[customerId]?.[periodKey] || null;
    }

    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(db(), 'customers', customerId, 'monthly_records', periodKey));
    return snap.exists() ? snap.data() : null;
}

// Keep aliases for backward compatibility if needed, but we will update callers
export const updateMonthlyPaymentHistory = updateMonthlySummary;
export const getMonthlyPaymentHistory = getMonthlySummary;
