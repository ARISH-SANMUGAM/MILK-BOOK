import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Share2, 
  ChevronRight, 
  Search, 
  FileText, 
  Wallet,
  Calendar,
  ChevronLeft,
  X,
  Phone,
  MessageCircle,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  MoreVertical,
  ArrowLeft,
  Milk,
  User,
  CheckCircle2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getMonthlySummary, updateMonthlySummary, recordPayment, MonthlySummary } from '../services/db';
import { formatCurrency, getMonthName, getPrevMonth, getNextMonth, formatDate } from '../utils/calculations';
import { generateIndividualPDF, downloadCustomerCSV } from '../utils/reports';

const Reports: React.FC = () => {
  const { customers, settings, loading, refreshCustomers } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [reportStats, setReportStats] = useState({ totalBill: 0, totalCollected: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [customerSummaries, setCustomerSummaries] = useState<Record<string, MonthlySummary>>({});

  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const isPassedMonth = year < currentYear || (year === currentYear && month < currentMonth);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const promises = customers.map(c => updateMonthlySummary(c.id, year, month));
        const summaries = await Promise.all(promises);
        
        let bill = 0;
        let collected = 0;
        const summariesMap: Record<string, MonthlySummary> = {};
        
        summaries.forEach((s, index) => {
          if (s) {
            summariesMap[customers[index].id] = s;
            bill += s.current_bill || 0;
            collected += s.total_paid || 0;
          }
        });
        
        setCustomerSummaries(summariesMap);
        setReportStats({ totalBill: bill, totalCollected: collected });
      } catch (err) {
        console.error("Failed to fetch monthly stats", err);
      } finally {
        setStatsLoading(false);
      }
    };
    
    if (customers.length > 0) {
      fetchStats();
    }
  }, [customers, month, year]);

  const handlePrevMonth = () => {
    const { m, y } = getPrevMonth(month, year);
    setSelectedDate(new Date(y, m - 1));
  };

  const handleNextMonth = () => {
    const { m, y } = getNextMonth(month, year);
    setSelectedDate(new Date(y, m - 1));
  };

  const openCustomerReport = async (customer: any) => {
    setSelectedCustomer(customer);
    const summ = await getMonthlySummary(customer.id, year, month);
    setSummary(summ);
  };

  const handlePayment = async () => {
    if (!selectedCustomer || !paymentAmount || !summary) return;
    
    const amount = parseFloat(paymentAmount);
    
    if (amount > summary.pending_balance) {
      alert(`Payment cannot exceed the due amount of ${formatCurrency(summary.pending_balance)}.`);
      return;
    }

    await recordPayment(selectedCustomer.id, {
      amount: amount,
      month,
      year,
      method: 'cash',
      date: new Date().toISOString().split('T')[0]
    });
    setPaymentAmount('');
    openCustomerReport(selectedCustomer);
    refreshCustomers();
  };

  const shareOnWhatsApp = (customer: any, summ: MonthlySummary) => {
    const text = `*MilkBook Report*\n` +
      `Customer: ${customer.name}\n` +
      `Period: ${getMonthName(month)} ${year}\n` +
      `Total Qty: ${summ.total_litres} L\n` +
      `Bill: ${formatCurrency(summ.current_bill)}\n` +
      `Paid: ${formatCurrency(summ.total_paid)}\n` +
      `Due: ${formatCurrency(summ.pending_balance)}\n\n` +
      `Thank you!`;
    
    const phone = customer.phone.replace(/\D/g, '');
    const mobile = phone.length === 10 ? `91${phone}` : phone;
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search)
    ).sort((a, b) => {
      const summA = customerSummaries[a.id];
      const summB = customerSummaries[b.id];
      
      const isUnequalA = summA ? summA.current_bill !== summA.total_paid : false;
      const isUnequalB = summB ? summB.current_bill !== summB.total_paid : false;

      if (isUnequalA && !isUnequalB) return -1;
      if (!isUnequalA && isUnequalB) return 1;
      return (b.total_balance || 0) - (a.total_balance || 0);
    });
  }, [customers, search, customerSummaries]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.total_balance || 0), 0);
  }, [customers]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F1F4FF] font-sans pb-32">
      {/* 1. Page Title */}
      <div className="px-6 py-10">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Monthly Statement</h1>
      </div>

      {/* 2. Formal Summary Hero Card - Emerald/Navy Calibration */}
      <div className="px-6 mb-8">
        <div className="bg-gradient-to-br from-[#1e1b4b] via-[#1e1b4b] to-[#2e2a75] rounded-xl p-7 text-white shadow-2xl shadow-indigo-900/20 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-500/10 rounded-full blur-3xl -ml-12 -mb-12" />
          
          <div className="flex flex-col gap-6 relative z-10">
            <div className="relative overflow-hidden p-6 rounded-lg bg-white/10 border border-white/10 shadow-inner backdrop-blur-sm">
               <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5">Net Pending (This Month)</p>
               <h2 className="text-3xl font-black tracking-tight text-[#ff0000]">
                 {formatCurrency(reportStats.totalBill - reportStats.totalCollected)}
               </h2>
               <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mb-12 -mr-12" />
            </div>
            
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div>
                <p className="text-indigo-300/70 text-[10px] font-bold uppercase tracking-wider mb-1">Monthly Billing</p>
                <p className="text-xl font-bold text-white">{formatCurrency(reportStats.totalBill)}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-300/70 text-[10px] font-bold uppercase tracking-wider mb-1">Total Collected</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(reportStats.totalCollected)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Action Area (Month Select & Search) */}
      <div className="px-6 mb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between bg-white rounded-xl p-2 border border-slate-900/30">
          <button onClick={handlePrevMonth} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <span className="text-xs font-black text-[#1e1b4b] uppercase tracking-widest">
            {getMonthName(month)} {year}
          </span>
          <button onClick={handleNextMonth} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search customers or phone numbers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-900/30 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>
      </div>

      {/* 4. Customer List (Formal Style) */}
      <div className="px-6 space-y-3">
        {filteredCustomers.map((c) => {
          const summ = customerSummaries[c.id];
          const monthDue = (summ?.current_bill || 0) - (summ?.total_paid || 0);
          // A month is only pending if its own bill is unpaid AND the customer still owes money overall
          const isPending = monthDue > 0 && (c.total_balance || 0) > 0;
          const initials = c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

            const cardStatusStyle = isPassedMonth 
              ? (isPending 
                  ? 'bg-gradient-to-r from-amber-50/60 to-transparent border-slate-900/30' 
                  : 'bg-gradient-to-r from-emerald-50/60 to-transparent border-slate-900/30')
              : 'bg-white border-slate-900/30';

            return (
              <motion.div 
                key={c.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => openCustomerReport(c)}
                className={`${cardStatusStyle} p-5 rounded-xl border transition-all flex items-center justify-between cursor-pointer group`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-600">
                    {initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-base group-hover:text-[#1e1b4b] transition-colors">{c.name}</h4>
                    <div className="mt-1.5 flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Monthly Bill</span>
                        <span className="text-sm font-bold text-slate-700">{formatCurrency(summ?.current_bill || 0)}</span>
                      </div>
                      <div className="w-[1px] h-5 bg-slate-200" />
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Received</span>
                        <span className="text-sm font-bold text-emerald-600">{formatCurrency(summ?.total_paid || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {isPassedMonth && (
                    <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded ${isPending ? 'text-amber-600 bg-amber-100' : 'text-emerald-600 bg-emerald-100'}`}>
                      {isPending ? 'Pending' : 'Settled'}
                    </span>
                  )}
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-[#1e1b4b] transition-colors" />
                </div>
              </motion.div>
            );
        })}
      </div>

      {/* 5. Professional Report Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{selectedCustomer.name}</h2>
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                    Account | {getMonthName(month)} {year}
                  </p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              {summary ? (
                <div className="overflow-y-auto p-6 space-y-8">
                  {/* Financial Grid */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 col-span-2 shadow-sm">
                        <div className="flex justify-between items-center">
                           <div>
                              <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Due Amount</p>
                              <p className="text-3xl font-black text-rose-600">{formatCurrency(summary.pending_balance)}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Consumed</p>
                              <p className="text-xl font-bold text-slate-700">{summary.total_litres} <span className="text-sm font-medium text-slate-400">Liters</span></p>
                           </div>
                        </div>
                     </div>
                     <div className="bg-[#1e1b4b] p-5 rounded-xl text-white shadow-lg shadow-indigo-100/20">
                        <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-1">Monthly Bill</p>
                        <p className="text-xl font-bold">{formatCurrency(summary.current_bill)}</p>
                     </div>
                     <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                        <p className="text-emerald-600/60 text-[10px] font-bold uppercase tracking-widest mb-1">Paid Amount</p>
                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.total_paid)}</p>
                     </div>
                  </div>

                  {/* ─── Detailed Consumption Log ─── */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between px-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Detailed Daily Consumption</label>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{summary.daily_entries.length} Records</span>
                     </div>
                     
                     <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="max-h-[250px] overflow-y-auto overflow-x-hidden">
                           <table className="w-full text-left border-collapse">
                              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm shadow-sm z-10">
                                 <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sessions</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {summary.daily_entries.map((entry: any) => {
                                    const total = (parseFloat(entry.morning_qty) || 0) + (parseFloat(entry.evening_qty) || 0);
                                    const dateObj = new Date(entry.date);
                                    const isToday = formatDate(new Date(), 'iso') === entry.date;

                                    return (
                                       <tr key={entry.date} className={`${entry.no_delivery ? "bg-rose-50/30" : ""} ${isToday ? "bg-indigo-50/30" : ""}`}>
                                          <td className="px-4 py-3">
                                             <div className="text-xs font-bold text-slate-700">{formatDate(entry.date, 'short')}</div>
                                             <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                                {dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
                                             </div>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                             <div className="flex items-center justify-center gap-1.5">
                                                <div className="flex flex-col items-center">
                                                   <span className="text-[8px] font-bold text-orange-400/70 uppercase scale-75">MOR</span>
                                                   <span className="text-[10px] font-bold text-slate-600">{entry.morning_qty}</span>
                                                </div>
                                                <div className="w-[1px] h-4 bg-slate-100" />
                                                <div className="flex flex-col items-center">
                                                   <span className="text-[8px] font-bold text-indigo-400/70 uppercase scale-75">EVE</span>
                                                   <span className="text-[10px] font-bold text-slate-600">{entry.evening_qty}</span>
                                                </div>
                                             </div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                             {entry.no_delivery ? (
                                                <span className="text-[9px] font-bold text-rose-500 uppercase px-2 py-0.5 bg-rose-50 border border-rose-100 rounded-md">Skipped</span>
                                             ) : (
                                                <span className="text-xs font-bold text-indigo-700">{total.toFixed(1)} L</span>
                                             )}
                                          </td>
                                       </tr>
                                    );
                                 })}
                                 {summary.daily_entries.length === 0 && (
                                    <tr>
                                       <td colSpan={3} className="px-4 py-12 text-center">
                                          <div className="text-slate-300 mb-2 font-medium">No records for this month</div>
                                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Entry history appears here</div>
                                       </td>
                                    </tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>

                  {/* Payment Field */}
                  {summary.pending_balance > 0 && (
                    <div className="space-y-3">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Record Payment</label>
                       <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                              type="number"
                              placeholder="0.00"
                              value={paymentAmount}
                              onChange={(e)=>setPaymentAmount(e.target.value)}
                              className="w-full pl-8 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:bg-white focus:border-[#1e1b4b] transition-all"
                            />
                          </div>
                          <button 
                            onClick={handlePayment}
                            className="bg-[#1e1b4b] text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#2e2b5b] active:scale-95 transition-all shadow-lg shadow-indigo-100"
                          >
                            Save
                          </button>
                       </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-4 pt-4">
                     <button 
                        onClick={()=>shareOnWhatsApp(selectedCustomer, summary)}
                        className="flex items-center justify-center gap-2.5 py-4 border border-emerald-200 rounded-xl text-emerald-700 font-bold text-xs uppercase tracking-widest hover:bg-emerald-50 transition-colors"
                     >
                        <MessageCircle size={18} fill="currentColor" />
                        WhatsApp
                     </button>
                     <button 
                        onClick={()=>generateIndividualPDF(selectedCustomer, summary.daily_entries, {
                          periodLabel: `${getMonthName(month)} ${year}`,
                          rate: settings.rate,
                          dateRange: {
                            start: `${year}-${String(month).padStart(2, '0')}-01`,
                            end: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
                          },
                          businessName: settings.businessName,
                          address: settings.address,
                          paymentQr: settings.paymentQr
                        })}
                        className="flex items-center justify-center gap-2.5 py-4 border border-slate-200 rounded-xl text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                     >
                        <FileText size={18} />
                        Download
                     </button>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                   <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Report...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Reports;
