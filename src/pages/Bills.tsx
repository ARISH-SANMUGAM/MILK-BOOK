import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search, 
  FileText, 
  ArrowLeft,
  MessageCircle,
  Download,
  Milk,
  User,
  QrCode,
  List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getMonthlySummary, updateMonthlySummary, MonthlySummary } from '../services/db';
import { formatCurrency, getMonthName, getPrevMonth, getNextMonth } from '../utils/calculations';
import { generateIndividualPDF, generateBulkInvoicesPDF } from '../utils/reports';
import UserMenu from '../components/UserMenu';

const WhatsAppIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const Bills: React.FC = () => {
  const { customers, settings, loading, refreshCustomers } = useAppContext();

  useEffect(() => {
    refreshCustomers();
  }, []);
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [customerSummaries, setCustomerSummaries] = useState<Record<string, MonthlySummary>>({});
  const [fetching, setFetching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);

  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();

  const handlePrintAll = async () => {
    try {
      const activeData = filteredCustomers
        .map(customer => ({
          customer,
          summary: customerSummaries[customer.id]
        }))
        .filter(item => item.summary);

      if (activeData.length === 0) return alert("No bills to print");

      await generateBulkInvoicesPDF(activeData, {
        periodLabel: `${getMonthName(month)} ${year}`,
        rate: settings.rate,
        businessName: settings.businessName,
        address: settings.address,
        paymentQr: settings.paymentQr,
        upiId: settings.upiId,
        month,
        year
      });
    } catch (err) {
      console.error('Print All failed:', err);
      alert('Failed to generate PDF. Check console for details.');
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setFetching(true);
      try {
        const promises = customers.map(c => getMonthlySummary(c.id, year, month));
        const summaries = await Promise.all(promises);
        
        const summariesMap: Record<string, MonthlySummary> = {};
        summaries.forEach((s, index) => {
          if (s) summariesMap[customers[index].id] = s;
        });
        
        setCustomerSummaries(summariesMap);
      } catch (err) {
        console.error("Failed to fetch all summaries", err);
      } finally {
        setFetching(false);
      }
    };
    
    if (customers.length > 0) {
      fetchAll();
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

  const shareOnWhatsApp = async (customer: any, summ: MonthlySummary) => {
    try {
      const monthlyBill = summ.current_bill || 0;
      const monthlyPaid = summ.total_paid || 0;
      const netBalance = customer.total_balance || 0;
      const oldBalance = Math.max(0, netBalance - (monthlyBill - monthlyPaid));

      // 1. Generate PDF
      const doc = await generateIndividualPDF(customer, summ.daily_entries || [], {
        periodLabel: `${getMonthName(month)} ${year}`,
        rate: settings.rate,
        month,
        year,
        businessName: settings.businessName,
        address: settings.address,
        paymentQr: settings.paymentQr,
        upiId: settings.upiId,
        oldBalance,
        totalBalance: netBalance,
        save: false // Don't download automatically
      });

      const blob = doc.output('blob');
      const filename = `${customer.name.replace(/\s+/g, '_')}_Bill_${getMonthName(month)}_${year}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      // 2. Try Web Share API (Best for Mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Milk Delivery Bill',
          text: `Milk Delivery Bill for ${customer.name} - ${getMonthName(month)} ${year}`
        });
        return;
      }

      // 3. Fallback to wa.me text link if file share fails/unsupported
      const text = `*Milk Bill Statement*\n` +
        `Customer: *${customer.name}*\n` +
        `Period: ${getMonthName(month)} ${year}\n` +
        `Total Qty: ${summ.total_litres} L\n` +
        `Bill Amount: ${formatCurrency(summ.current_bill)}\n` +
        `Total Paid: ${formatCurrency(summ.total_paid)}\n` +
        `*Pending Due: ${formatCurrency(summ.pending_balance)}*\n\n` +
        `_PDF Bill attached above (if failed, use this summary)._\n` +
        `Thank you for your business!`;
      
      const phone = customer.phone.replace(/\D/g, '');
      const mobile = phone.length === 10 ? `91${phone}` : phone;
      const url = `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error("WhatsApp share failed:", err);
      alert("Failed to share on WhatsApp");
    }
  };

  const handleDownloadReport = async (customer: any, summ: MonthlySummary) => {
    try {
      const monthlyBill = summ.current_bill || 0;
      const monthlyPaid = summ.total_paid || 0;
      const netBalance = customer.total_balance || 0;
      const oldBalance = Math.max(0, netBalance - (monthlyBill - monthlyPaid));

      console.log('Generating PDF for:', customer.name, { month, year, rate: settings.rate });

      await generateIndividualPDF(customer, summ.daily_entries || [], {
        periodLabel: `${getMonthName(month)} ${year}`,
        rate: settings.rate,
        month,
        year,
        businessName: settings.businessName,
        address: settings.address,
        paymentQr: settings.paymentQr,
        upiId: settings.upiId,
        oldBalance,
        totalBalance: netBalance
      });

      console.log('PDF generated successfully for:', customer.name);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Check console for details.');
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search)
    ).sort((a, b) => {
      const summA = customerSummaries[a.id];
      const summB = customerSummaries[b.id];
      const pendingA = summA ? summA.pending_balance : 0;
      const pendingB = summB ? summB.pending_balance : 0;
      return pendingB - pendingA;
    });
  }, [customers, search, customerSummaries]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* 1. Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
             <h1 className="font-black text-slate-800 tracking-tight">Digital Bills</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Send & Download</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <motion.button 
             whileTap={{ scale: 0.95 }}
             onClick={handlePrintAll}
             className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 flex items-center gap-2"
           >
             <Download size={14} strokeWidth={3} />
             Print All
           </motion.button>

           <UserMenu />
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between bg-white rounded-xl p-2 border border-slate-200 shadow-sm">
          <button onClick={handlePrevMonth} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center">
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Billing Cycle</span>
             <span className="text-xs font-black text-[#1e1b4b] uppercase tracking-widest">
               {getMonthName(month)} {year}
             </span>
          </div>
          <button onClick={handleNextMonth} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search customers to bill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Bills List */}
      <div className="px-6 space-y-4">
        {fetching ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e1b4b] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fetching Bills...</p>
          </div>
        ) : (
          filteredCustomers.map((customer, index) => {
            const summ = customerSummaries[customer.id];
            if (!summ) return null;

            // Reconciliation Logic
            const monthlyBill = summ.current_bill || 0;
            const monthlyPaid = summ.total_paid || 0;
            const netBalance = customer.total_balance || 0;
            const oldBalance = Math.max(0, netBalance - (monthlyBill - monthlyPaid));

            return (
                <motion.div 
                   key={customer.id} 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="bg-white rounded-[1.5rem] border border-slate-200 overflow-hidden shadow-sm relative group bg-gradient-to-br from-white via-white to-slate-50/50"
                >
                   {/* Card Header */}
                   <div className="p-4 flex justify-between items-start gap-3 border-b border-slate-50/50">
                      <div className="flex-1">
                         <h4 className="font-bold text-slate-800 text-base tracking-tight">{customer.name}</h4>
                         <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            {customer.phone}
                         </p>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 opacity-80">Pending to Pay</p>
                         <p className={`text-3xl font-black tracking-tighter drop-shadow-sm ${
                            netBalance > 0 ? 'text-transparent bg-clip-text bg-gradient-to-br from-rose-500 to-rose-700' : 'text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-emerald-700'
                         }`}>
                            {formatCurrency(netBalance)}
                         </p>
                      </div>
                   </div>
                   
                   {/* Summary Grid - Calibrated Glass Effect */}
                   <div className={`mx-4 my-2 p-3 grid grid-cols-2 gap-3 rounded-2xl border backdrop-blur-xl shadow-md relative overflow-hidden group/glass transition-all duration-500 ${
                      netBalance > 0 
                         ? 'bg-rose-50/40 border-rose-100/50 shadow-rose-100/20' 
                         : 'bg-emerald-50/40 border-emerald-100/50 shadow-emerald-100/20'
                   }`}>
                      <div className="relative space-y-0.5">
                         <p className="text-[8px] font-black text-slate-500/80 uppercase tracking-widest">Monthly Bill</p>
                         <p className="text-base font-black text-slate-800 tracking-tight">{formatCurrency(monthlyBill)}</p>
                      </div>
                      <div className="relative space-y-0.5 text-right">
                         <p className="text-[8px] font-black text-slate-500/80 uppercase tracking-widest">Total Received</p>
                         <p className={`text-base font-black tracking-tight ${netBalance > 0 ? 'text-emerald-600' : 'text-emerald-700'}`}>
                            {formatCurrency(monthlyPaid)}
                         </p>
                      </div>
                   </div>

                   {/* Daily Entries Section */}
                   <div className={`p-4 border-b border-slate-50 bg-gradient-to-br transition-colors duration-500 ${netBalance > 0 ? 'from-white via-white to-rose-50/30' : 'from-white via-white to-emerald-50/30'}`}>
                      <div className="flex items-center gap-2 mb-3">
                         <List size={11} className="text-indigo-400" />
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Milk Log Overview</span>
                      </div>

                      <div className="mb-4">
                         <table className="w-full text-[10px]">
                            <thead>
                               <tr className="text-slate-400 border-b border-slate-100">
                                  <th className="text-left font-bold py-1.5 uppercase text-[7px] tracking-widest">Date</th>
                                  <th className="text-center font-bold uppercase text-[7px] tracking-widest">Morn</th>
                                  <th className="text-center font-bold uppercase text-[7px] tracking-widest">Eve</th>
                                  <th className="text-right font-bold pr-2 uppercase text-[7px] tracking-widest">Total Qty</th>
                               </tr>
                            </thead>
                            <tbody>
                               {(() => {
                                  let runningTotalValue = 0;
                                  const activeEntries = summ.daily_entries.filter(e => (parseFloat(e.morning_qty as any) || 0) > 0 || (parseFloat(e.evening_qty as any) || 0) > 0);
                                  
                                  return activeEntries.map((e, idx) => {
                                     const mQty = parseFloat(e.morning_qty as any) || 0;
                                     const eQty = parseFloat(e.evening_qty as any) || 0;
                                     const dailyTotal = mQty + eQty;
                                     runningTotalValue += dailyTotal;
                                     
                                     if (idx >= 5 && expandedId !== customer.id) return null;

                                     return (
                                        <tr key={e.date} className="border-b border-slate-50/50 hover:bg-slate-50/50 transition-colors">
                                           <td className="py-1.5 font-bold text-slate-500">
                                              {e.date.split('-')[2]} <span className="text-[7px] font-medium opacity-60 uppercase">{getMonthName(month).slice(0,3)}</span>
                                           </td>
                                           <td className="py-1.5 text-center text-orange-600 font-black">{mQty > 0 ? mQty : '—'}</td>
                                           <td className="py-1.5 text-center text-indigo-600 font-black">{eQty > 0 ? eQty : '—'}</td>
                                           <td className="py-1.5 text-right font-black text-slate-800 pr-1">{dailyTotal}L</td>
                                        </tr>
                                     );
                                  });
                               })()}
                            </tbody>
                            <tfoot className="bg-slate-50/80">
                               <tr>
                                  <td colSpan={3} className="py-2.5 text-right font-bold text-[8px] uppercase tracking-widest text-slate-500 pr-4">Total Consumed</td>
                                  <td className="py-2.5 text-right font-black text-indigo-700 pr-1 text-sm">{summ.total_litres}L</td>
                               </tr>
                            </tfoot>
                         </table>
                         
                         {summ.daily_entries.filter(e => (parseFloat(e.morning_qty as any) || 0) > 0 || (parseFloat(e.evening_qty as any) || 0) > 0).length > 5 && (
                            <button 
                               onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
                               className="w-full text-center py-2 text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50/50 transition-colors mt-0.5 rounded-lg"
                            >
                               {expandedId === customer.id ? 'Show Less' : `+ ${summ.daily_entries.filter(e => (parseFloat(e.morning_qty as any) || 0) > 0 || (parseFloat(e.evening_qty as any) || 0) > 0).length - 5} more`}
                            </button>
                         )}

                         {summ.daily_entries.filter(e => (parseFloat(e.morning_qty as any) || 0) > 0 || (parseFloat(e.evening_qty as any) || 0) > 0).length === 0 && (
                            <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl">
                               <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">No entries recorded</p>
                            </div>
                         )}
                      </div>

                      {/* Bill Footer Section - After Daily Entries */}
                      <div className="flex items-end justify-between gap-3 pt-3 border-t border-slate-100/50">
                         {/* Greetings & Address (Left) */}
                         <div className="flex-1 text-left">
                            <p className="text-[9px] font-black text-indigo-900 mb-0.5">Thank You!</p>
                            <p className="text-[6px] font-bold text-slate-400 uppercase tracking-tighter max-w-[120px] line-clamp-2">
                               {settings.address || 'MilkBook Premier Service'}
                            </p>
                         </div>

                         {/* QR Code (Right) */}
                         <div className="flex flex-col items-center gap-1 transition-all group-hover:scale-105">
                            <div className="w-16 h-16 flex items-center justify-center overflow-hidden">
                               {settings.upiId && netBalance > 0 ? (
                                  <img 
                                     src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.businessName)}&am=${netBalance}&cu=INR&tn=Milk%20Bill`)}`} 
                                     alt="Pay QR" 
                                     className="w-full h-full object-contain" 
                                  />
                               ) : settings.paymentQr ? (
                                  <img src={settings.paymentQr} alt="Pay QR" className="w-full h-full object-contain" />
                               ) : (
                                  <QrCode size={24} className="text-slate-200" />
                               )}
                            </div>
                            <p className="text-[7px] font-black text-slate-800 uppercase tracking-widest bg-white/80 px-1.5 py-0.5 rounded-full border border-slate-100 shadow-sm">
                               Pay {formatCurrency(netBalance)}
                            </p>
                         </div>
                      </div>
                   </div>

                   {/* Quick Actions */}
                   <div className="grid grid-cols-2 divide-x divide-slate-100 bg-white">
                       <button 
                          onClick={() => shareOnWhatsApp(customer, summ)}
                          className="py-3 flex flex-col items-center justify-center gap-1.5 hover:bg-emerald-50 text-emerald-600 transition-all group/btn"
                       >
                          <WhatsAppIcon size={18} className="text-emerald-500 drop-shadow-sm group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[8px] font-black uppercase tracking-widest">WhatsApp</span>
                       </button>

                      <button 
                         onClick={() => handleDownloadReport(customer, summ)}
                         className="py-3 flex flex-col items-center justify-center gap-1.5 hover:bg-indigo-50 text-indigo-900 transition-all group/btn"
                      >
                         <Download size={16} strokeWidth={3} className="opacity-80 group-hover/btn:scale-110 transition-transform" />
                         <span className="text-[8px] font-black uppercase tracking-widest">PDF Bill</span>
                      </button>
                   </div>
                </motion.div>
            );
          })
        )}

        {!fetching && filteredCustomers.length === 0 && (
          <div className="py-20 text-center text-slate-400">
             <FileText size={40} className="mx-auto mb-4 opacity-20" />
             <p className="text-xs font-bold uppercase tracking-widest">No matching bills</p>
          </div>
        )}
      </div>
      {/* 6. QR Code Modal */}
      <AnimatePresence>
        {showQr && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQr(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl"
            >
              <h3 className="text-lg font-black text-slate-800 mb-1">Scan to Pay</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">UPI Payment for {customers.find(c => c.id === showQr)?.name}</p>
              
              <div className="aspect-square bg-slate-50 rounded-2xl border-4 border-slate-100 flex items-center justify-center mb-6 overflow-hidden">
                {settings.paymentQr ? (
                  <img src={settings.paymentQr} alt="Payment QR" className="w-full h-full object-contain" />
                ) : (
                   <div className="text-slate-300 flex flex-col items-center gap-2">
                      <QrCode size={48} strokeWidth={1} />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No QR Uploaded</p>
                   </div>
                )}
              </div>

              <div className="bg-indigo-50 p-4 rounded-xl mb-6">
                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">UPI ID</p>
                <p className="font-black text-indigo-700">{settings.upiId || '—'}</p>
              </div>

              <button 
                onClick={() => setShowQr(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm uppercase tracking-widest active:scale-95 transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Bills;
