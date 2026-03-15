import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileText, 
  ArrowLeft,
  MessageCircle,
  Download,
  Milk
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { updateMonthlySummary, MonthlySummary } from '../services/db';
import { formatCurrency, getMonthName, getPrevMonth, getNextMonth } from '../utils/calculations';
import { generateIndividualPDF } from '../utils/reports';

const Bills: React.FC = () => {
  const { customers, settings, loading } = useAppContext();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [customerSummaries, setCustomerSummaries] = useState<Record<string, MonthlySummary>>({});
  const [fetching, setFetching] = useState(false);

  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();

  useEffect(() => {
    const fetchAll = async () => {
      setFetching(true);
      try {
        const promises = customers.map(c => updateMonthlySummary(c.id, year, month));
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

  const handleDownloadReport = (customer: any, summ: MonthlySummary) => {
     generateIndividualPDF(customer, summ.daily_entries, {
        periodLabel: `${getMonthName(month)} ${year}`,
        rate: settings.rate,
        dateRange: {
          start: `${year}-${String(month).padStart(2, '0')}-01`,
          end: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
        },
        businessName: settings.businessName,
        address: settings.address,
        paymentQr: settings.paymentQr
     });
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
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 flex items-center gap-3">
        <button onClick={() => navigate('/reports')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
           <h1 className="font-black text-slate-800 tracking-tight">Digital Bills</h1>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Send & Download</p>
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

            return (
               <motion.div 
                 key={customer.id} 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
               >
                  <div className="p-5 flex justify-between items-start gap-4 border-b border-slate-50">
                     <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{customer.name}</h4>
                        <div className="mt-1 flex items-center gap-2">
                           <span className="text-xs font-semibold text-slate-500">{customer.phone}</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Due</p>
                        <p className={`text-lg font-black ${summ.pending_balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                           {formatCurrency(summ.pending_balance)}
                        </p>
                     </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-4">
                     <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Bill</p>
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(summ.current_bill)}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Qty Consumed</p>
                        <p className="text-sm font-bold text-slate-700">{summ.total_litres} L</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                     <button 
                        id={index === 0 ? "tour-whatsapp-btn" : undefined}
                        onClick={() => shareOnWhatsApp(customer, summ)}
                        className="py-4 flex flex-col items-center justify-center gap-1.5 hover:bg-emerald-50 text-emerald-600 transition-colors group"
                     >
                        <MessageCircle size={18} fill="currentColor" className="opacity-80 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">WhatsApp</span>
                     </button>
                     <button 
                        id={index === 0 ? "tour-download-btn" : undefined}
                        onClick={() => handleDownloadReport(customer, summ)}
                        className="py-4 flex flex-col items-center justify-center gap-1.5 hover:bg-indigo-50 text-[#1e1b4b] transition-colors group"
                     >
                        <Download size={18} strokeWidth={2.5} className="opacity-80 group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Download PDF</span>
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
    </div>
  );
};

export default Bills;
