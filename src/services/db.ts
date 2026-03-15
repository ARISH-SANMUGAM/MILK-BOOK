import { db } from './firebase';
import { 
  collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, query, where, orderBy, increment, writeBatch 
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────
export interface Settings {
  rate: number;
  businessName: string;
  address: string;
  paymentQr?: string;
  [key: string]: any;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  default_qty: number;
  total_balance: number;
  marked_for_deletion?: boolean;
  delete_scheduled_at?: string;
  [key: string]: any;
}

export interface DailyRecord {
  date: string;
  morning_qty: number;
  evening_qty: number;
  morning_collected: boolean;
  evening_collected: boolean;
  total_litres: number;
  rate_per_litre: number;
  daily_amount: number;
  no_delivery: boolean;
  [key: string]: any;
}

export interface Payment {
  id: string;
  amount: number;
  month: number;
  year: number;
  method: string;
  note: string;
  date: string;
}

export interface MonthlySummary {
  periodKey: string;
  month: number;
  year: number;
  total_litres: number;
  rate_per_litre: number;
  total_paid: number;
  current_bill: number;
  pending_balance: number;
  is_collected: boolean;
  status: 'paid' | 'partial' | 'due';
  daily_entries: DailyRecord[];
  payments: Payment[];
  updatedAt: string;
}

// ─── Local Storage ────────────────────────────────────────
const LOCAL_STORAGE_KEY = 'milkbook_v3'; // Incremented version for React

const LOCAL = {
  get() {
    try {
      const r = localStorage.getItem(LOCAL_STORAGE_KEY);
      return r ? JSON.parse(r) : { settings: { rate: 60, businessName: 'MilkBook', address: '' }, customers: {}, records: {}, payments: {}, monthlyRecords: {} };
    } catch {
      return { settings: { rate: 60, businessName: 'MilkBook', address: '' }, customers: {}, records: {}, payments: {}, monthlyRecords: {} };
    }
  },
  save(s: any) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(s));
  },
  monthBounds(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { start, end };
  },
};

export const getLocalData = () => LOCAL.get();

// ─── Settings ─────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  const localSettings = LOCAL.get().settings;
  try {
    const snap = await getDoc(doc(db, 'settings', 'config'));
    return snap.exists() ? (snap.data() as Settings) : localSettings;
  } catch {
    return localSettings;
  }
}

export async function saveSettings(data: Partial<Settings>): Promise<void> {
  const s = LOCAL.get();
  s.settings = { ...s.settings, ...data };
  LOCAL.save(s);

  try {
    await setDoc(doc(db, 'settings', 'config'), data, { merge: true });
  } catch (err) {
    console.error("Firebase saveSettings error", err);
  }
}

// ─── Customers ────────────────────────────────────────────
export async function getCustomers(includeHidden = false): Promise<Customer[]> {
  try {
    const snap = await getDocs(collection(db, 'customers'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));

    const s = LOCAL.get();
    const cloudIds = new Set(list.map(c => c.id));
    Object.keys(s.customers).forEach(id => {
      if (!cloudIds.has(id)) delete s.customers[id];
    });
    list.forEach(c => {
      s.customers[c.id] = c;
    });
    LOCAL.save(s);

    const activeList: Customer[] = [];
    const now = new Date().toISOString();

    for (const c of list) {
      if (!includeHidden && c.marked_for_deletion && c.delete_scheduled_at) {
        if (now >= c.delete_scheduled_at) {
          deleteCustomer(c.id).catch(() => { });
          continue;
        }
        continue;
      }
      activeList.push(c);
    }
    return activeList;
  } catch {
    const s = LOCAL.get();
    return Object.values(s.customers) as Customer[];
  }
}

export async function saveCustomer(data: Partial<Customer>): Promise<string> {
  const { id, ...rest } = data;
  const payload = { ...rest, total_balance: rest.total_balance ?? 0 };

  try {
    if (id) {
      await setDoc(doc(db, 'customers', id), payload, { merge: true });
      const s = LOCAL.get();
      s.customers[id] = { ...(s.customers[id] || {}), ...payload, id };
      LOCAL.save(s);
      return id;
    } else {
      const ref = await addDoc(collection(db, 'customers'), payload);
      const s = LOCAL.get();
      s.customers[ref.id] = { ...payload, id: ref.id };
      LOCAL.save(s);
      return ref.id;
    }
  } catch (err) {
    const custId = id || ('cust_' + Date.now());
    const s = LOCAL.get();
    s.customers[custId] = { ...(s.customers[custId] || {}), ...payload, id: custId };
    LOCAL.save(s);
    return custId;
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  const s = LOCAL.get();
  delete s.customers[id];
  if (s.records) delete s.records[id];
  if (s.payments) delete s.payments[id];
  if (s.monthlyRecords) delete s.monthlyRecords[id];
  LOCAL.save(s);

  try {
    const customerDocRef = doc(db, 'customers', id);
    const subCollections = ['payments', 'daily_records', 'monthly_records'];
    for (const sub of subCollections) {
      const snap = await getDocs(collection(customerDocRef, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    await deleteDoc(customerDocRef);
  } catch (err) {
    console.error("Firebase deleteCustomer error", err);
  }
}

// ─── Daily Records ────────────────────────────────────────
export async function saveDailyRecord(customerId: string, date: string, data: Partial<DailyRecord>): Promise<void> {
  // Fallback for single record updates (though we prefer batch for Daily Entry)
  return saveBatchDailyRecords(date, [{ customerId, data }]);
}

/**
 * Save multiple daily records in an atomic batch.
 * This is more reliable and efficient for the Daily Entry page.
 */
 export async function saveBatchDailyRecords(date: string, updates: { customerId: string, data: Partial<DailyRecord> }[]): Promise<void> {
  const s = LOCAL.get();
  const batch = writeBatch(db);
  
  const [y, m] = date.split('-').map(Number);
  console.log(`💾 Initiating batch save for ${date}...`);

  for (const update of updates) {
    const { customerId, data } = update;
    
    // Explicitly numberify for cloud safety
    const morning_qty = parseFloat(data.morning_qty as any) || 0;
    const evening_qty = parseFloat(data.evening_qty as any) || 0;
    const daily_amount = parseFloat(data.daily_amount as any) || 0;
    const total_litres = parseFloat(data.total_litres as any) || 0;

    const cloudData = {
      ...data,
      morning_qty,
      evening_qty,
      daily_amount,
      total_litres
    };
    
    // 1. Calculate balance difference first
    const prevLocal = s.records[customerId]?.[date];
    const prevAmount = parseFloat(prevLocal?.daily_amount as any) || 0;
    const diff = daily_amount - prevAmount;

    // 2. Update Local Store
    if (!s.records[customerId]) s.records[customerId] = {};
    s.records[customerId][date] = { date, ...cloudData };
    
    if (s.customers[customerId]) {
      s.customers[customerId].total_balance = (s.customers[customerId].total_balance || 0) + diff;
    }

    // 3. Queue Cloud Batch
    const recordRef = doc(db, 'customers', customerId, 'daily_records', date);
    batch.set(recordRef, { date, ...cloudData }, { merge: true });

    if (diff !== 0) {
      const customerRef = doc(db, 'customers', customerId);
      batch.update(customerRef, { total_balance: increment(diff) });
    }
  }

  // Save locally immediately for snappy UI
  LOCAL.save(s);

  try {
    await batch.commit();
    console.log("✅ Cloud Sync Successful");
    
    // 4. Background Summary updates
    for (const update of updates) {
      try {
        await updateMonthlySummary(update.customerId, y, m);
      } catch (err) {
        console.warn(`Summary update failed for ${update.customerId}`, err);
      }
    }
  } catch (err) {
    console.error("❌ Cloud Sync Failed", err);
    throw err;
  }
}

export async function getDailyRecord(customerId: string, date: string): Promise<DailyRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'customers', customerId, 'daily_records', date));
    return snap.exists() ? (snap.data() as DailyRecord) : null;
  } catch {
    const s = LOCAL.get();
    return s.records?.[customerId]?.[date] || null;
  }
}

export async function getDailyRecords(customerId: string, year: number, month: number): Promise<DailyRecord[]> {
  const { start, end } = LOCAL.monthBounds(year, month);
  try {
    const q = query(
      collection(db, 'customers', customerId, 'daily_records'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DailyRecord);
  } catch {
    const s = LOCAL.get();
    const all = s.records?.[customerId] || {};
    return Object.values(all)
      .filter((r: any) => r.date >= start && r.date <= end)
      .sort((a: any, b: any) => a.date.localeCompare(b.date)) as DailyRecord[];
  }
}

// ─── Payments ─────────────────────────────────────────────
export async function recordPayment(customerId: string, paymentData: any): Promise<string> {
  const { amount, month, year, method = 'cash', note = '', date } = paymentData;
  const payId = `pay_${Date.now()}`;
  const payload = { id: payId, amount: parseFloat(amount), month, year, method, note, date };

  const s = LOCAL.get();
  if (!s.payments[customerId]) s.payments[customerId] = {};
  s.payments[customerId][payId] = payload;
  if (s.customers[customerId]) {
    s.customers[customerId].total_balance = (s.customers[customerId].total_balance || 0) - parseFloat(amount);
  }
  LOCAL.save(s);

  try {
    const currentSnap = await getDoc(doc(db, 'customers', customerId));
    const currentData = currentSnap.data();
    const currentBalance = currentData?.total_balance || 0;
    
    // Safety check: if system is strict, we could prevent overpayment here,
    // but we'll do it primarily in the UI.
    
    await setDoc(doc(db, 'customers', customerId), {
      total_balance: increment(-parseFloat(amount)),
    }, { merge: true });

    await setDoc(doc(db, 'customers', customerId, 'payments', payId), payload);

    if (date) {
      const [py, pm] = date.split('-').map(Number);
      await updateMonthlySummary(customerId, py, pm);
      if (py !== year || pm !== month) {
        await updateMonthlySummary(customerId, year, month);
      }
    } else {
      await updateMonthlySummary(customerId, year, month);
    }
  } catch (err) {
    console.error("Firebase recordPayment error", err);
  }

  return payId;
}

export async function getPayments(customerId: string, year?: number, month?: number): Promise<Payment[]> {
  try {
    let q = collection(db, 'customers', customerId, 'payments') as any;
    if (year && month) {
      q = query(q, where('year', '==', year), where('month', '==', month));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Payment);
  } catch {
    const s = LOCAL.get();
    const all = s.payments?.[customerId] || {};
    return Object.values(all).filter((p: any) => {
      if (year && month) return p.year === year && p.month === month;
      return true;
    }) as Payment[];
  }
}

// ─── Monthly Summary ──────────────────────────────────────
export async function updateMonthlySummary(customerId: string, year: number, month: number): Promise<MonthlySummary> {
  const [records, allPayments] = await Promise.all([
    getDailyRecords(customerId, year, month).catch(() => []),
    getPayments(customerId).catch(() => [])
  ]);

  const total_litres = records.reduce((s, r) => s + (parseFloat(r.total_litres as any) || 0), 0);
  const latestRecord = records.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const rate_per_litre = parseFloat(latestRecord?.rate_per_litre as any || 60);

  const current_bill = Math.round(total_litres * rate_per_litre);
  const attributedPayments = allPayments.filter(p => p.month === month && p.year === year);
  const total_paid = attributedPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const pending_balance = Math.max(0, current_bill - total_paid);
  const is_collected = total_paid >= current_bill && current_bill > 0;
  const status = is_collected ? 'paid' : (total_paid > 0 ? 'partial' : 'due');

  const periodKey = `${year}-${String(month).padStart(2, '0')}`;
  const summary: MonthlySummary = {
    periodKey,
    month,
    year,
    total_litres: parseFloat(total_litres.toFixed(2)),
    rate_per_litre,
    total_paid,
    current_bill,
    pending_balance,
    is_collected,
    status: status as any,
    daily_entries: records.sort((a, b) => a.date.localeCompare(b.date)),
    payments: attributedPayments.sort((a, b) => a.date.localeCompare(b.date)),
    updatedAt: new Date().toISOString()
  };

  const s = LOCAL.get();
  if (!s.monthlyRecords) s.monthlyRecords = {};
  if (!s.monthlyRecords[customerId]) s.monthlyRecords[customerId] = {};
  s.monthlyRecords[customerId][periodKey] = summary;
  LOCAL.save(s);

  try {
    await setDoc(doc(db, 'customers', customerId, 'monthly_records', periodKey), summary, { merge: true });
  } catch (err) {
    console.error("Firebase updateMonthlySummary error", err);
  }

  return summary;
}

export async function getMonthlySummary(customerId: string, year: number, month: number): Promise<MonthlySummary | null> {
  const periodKey = `${year}-${String(month).padStart(2, '0')}`;
  try {
    const snap = await getDoc(doc(db, 'customers', customerId, 'monthly_records', periodKey));
    return snap.exists() ? (snap.data() as MonthlySummary) : null;
  } catch {
    const s = LOCAL.get();
    return s.monthlyRecords?.[customerId]?.[periodKey] || null;
  }
}

/**
 * ─── Cleanup: Reset negative balances to 0 ──────────────────
 * Triggered when user wants to fix "minus payments" (overpayments).
 */
export async function cleanupCustomersBalance(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'customers'));
    const updates = snap.docs.map(async (d) => {
      const data = d.data() as Customer;
      let needsUpdate = false;
      let newBalance = data.total_balance;

      // 1. Cleanup individual negative payments within subcollection
      const paymentsSnap = await getDocs(collection(db, 'customers', d.id, 'payments'));
      for (const p of paymentsSnap.docs) {
        const payData = p.data();
        if (payData.amount < 0) {
          // Subtract the "negative payment" from balance (which effectively undoes its addition)
          newBalance -= payData.amount; 
          await deleteDoc(p.ref);
          needsUpdate = true;
        }
      }

      // 2. Cap negative balance to 0 (Overpayment fix)
      if (newBalance < 0) {
        newBalance = 0;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await setDoc(doc(db, 'customers', d.id), { total_balance: newBalance }, { merge: true });
        
        // Sync local storage
        const s = LOCAL.get();
        if (s.customers[d.id]) {
          s.customers[d.id].total_balance = newBalance;
          LOCAL.save(s);
        }
      }
    });
    await Promise.all(updates);
  } catch (err) {
    console.error("Cleanup error", err);
  }
}
