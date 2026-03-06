/**
 * calculations.js — MilkBook v2
 * Pure ES-module business logic. No external dependencies.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calculate the daily amount from morning + evening quantities and the rate. */
export function calcDailyAmount(morningQty, eveningQty, ratePerLitre) {
    const m = parseFloat(morningQty) || 0;
    const e = parseFloat(eveningQty) || 0;
    const r = parseFloat(ratePerLitre) || 0;
    const litres = Math.round((m + e) * 100) / 100;
    const amount = Math.round(litres * r * 100) / 100;
    return { litres, amount };
}

/** Calculate totals for an array of daily records. */
export function calcMonthlyTotals(records = [], ratePerLitre) {
    let totalLitres = 0, totalAmount = 0, daysDelivered = 0;
    for (const rec of records) {
        if (rec.no_delivery) continue;
        const l = parseFloat(rec.total_litres) || 0;
        const a = parseFloat(rec.daily_amount) || 0;
        totalLitres += l;
        totalAmount += a;
        if (l > 0) daysDelivered++;
    }
    return {
        totalLitres: Math.round(totalLitres * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        daysDelivered,
    };
}

/**
 * Format a JS Date.
 * @param {Date} date
 * @param {'iso'|'full'|'entry'|'short'} format
 */
export function formatDate(date = new Date(), format = 'short') {
    const d = date instanceof Date ? date : new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
    const MonName = MONTH_SHORT[d.getMonth()];

    switch (format) {
        case 'iso': return `${year}-${mon}-${day}`;
        case 'full': return `${dayName}, ${d.getDate()} ${MonName} ${year}`;
        case 'entry': return `${d.getDate()} ${MonName} ${year}`;
        default: return `${d.getDate()} ${MonName}`;
    }
}

/** Format a rupee amount, e.g. 1234.5 → "₹1,234.50" */
export function formatCurrency(amount) {
    const n = parseFloat(amount) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Get the full month name, e.g. getMonthName(2) → "February" */
export function getMonthName(month) {
    return MONTH_NAMES[(month - 1 + 12) % 12];
}

/** Get the number of days in a given month/year */
export function getDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

/** Return { m, y } for the previous month */
export function getPrevMonth(month, year) {
    if (month === 1) return { m: 12, y: year - 1 };
    return { m: month - 1, y: year };
}

/** Return { m, y } for the next month */
export function getNextMonth(month, year) {
    if (month === 12) return { m: 1, y: year + 1 };
    return { m: month + 1, y: year };
}

// Legacy window export for any inline scripts
if (typeof window !== 'undefined') {
    window.Calc = {
        calcDailyAmount, calcMonthlyTotals, formatDate, formatCurrency,
        getMonthName, getDaysInMonth, getPrevMonth, getNextMonth
    };
}
