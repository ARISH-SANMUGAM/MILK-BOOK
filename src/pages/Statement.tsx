import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  Printer, 
  Share2, 
  Milk, 
  Calendar,
  ChevronRight,
  ArrowLeft,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getMonthlySummary, updateMonthlySummary, MonthlySummary } from '../services/db';
import { formatCurrency, getMonthName, getPrevMonth, getNextMonth, formatDate } from '../utils/calculations';
import { generateIndividualPDF } from '../utils/reports';

const StatementCard = ({ customer, summ, settings, month, year }: any) => {
  const [expanded, setExpanded] = useState(false);
  const displayEntries = expanded ? summ.daily_entries : summ.daily_entries.slice(0, 5);

  const shareOnWhatsApp = () => {
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

  const pendingAmount = summ.pending_balance;
  const dynamicQr = settings.upiId && pendingAmount > 0
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${settings.upiId}&pn=${settings.businessName}&cu=INR&am=${pendingAmount}`)}`
    : settings.paymentQr;

  const handleDownloadReport = async () => {
    try {
      await generateIndividualPDF(customer, summ.daily_entries || [], {
        periodLabel: `${getMonthName(month)} ${year}`,
        rate: settings.rate,
        month,
        year,
        businessName: settings.businessName,
        address: settings.address,
        paymentQr: dynamicQr,
        upiId: settings.upiId,
        totalBalance: summ.pending_balance
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const leftCol = summ.daily_entries.slice(0, 16);
  const rightCol = summ.daily_entries.slice(16);

  const TableHeader = () => (
    <thead>
      <tr className="bg-slate-50/80">
        <th className="px-4 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
        <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Mor</th>
        <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Eve</th>
        <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Total</th>
        <th className="px-4 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
      </tr>
    </thead>
  );

  const renderRow = (entry: any) => (
    <tr key={entry.date}>
      <td className="px-4 py-2 text-[9px] font-semibold text-slate-600 italic">
         {formatDate(entry.date, 'short')}
      </td>
      <td className="px-2 py-2 text-center text-[9px] font-medium text-slate-500">
        {entry.no_delivery ? 0 : (entry.morning_qty || 0)}
      </td>
      <td className="px-2 py-2 text-center text-[9px] font-medium text-slate-500">
        {entry.no_delivery ? 0 : (entry.evening_qty || 0)}
      </td>
      <td className="px-2 py-2 text-center text-[9px] font-bold text-slate-700">
        {entry.no_delivery ? 0 : entry.total_litres}
      </td>
      <td className="px-4 py-2 text-right text-[9px] font-bold text-slate-800">
        {formatCurrency(entry.daily_amount)}
      </td>
    </tr>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm shadow-slate-200/50 print:border-0 print:shadow-none print:rounded-none print:break-after-page print:mb-10">
      {/* Statement Header */}
      <div className="bg-[#1e1b4b] text-white p-6 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-black tracking-tight">{settings.businessName}</h3>
          <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest mt-0.5">Delivery Statement</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Date Range</p>
          <p className="text-xs font-bold">{getMonthName(month)} 01 - {new Date(year, month, 0).getDate()}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="p-6 border-b border-slate-50 flex justify-between gap-4">
         <div className="flex-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bill To</p>
            <h4 className="font-bold text-slate-800 text-sm">{customer.name}</h4>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{customer.phone}</p>
            {customer.address && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{customer.address}</p>}
         </div>
         <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Grand Total Due</p>
            <p className="text-xl font-black text-[#ff0000]">{formatCurrency(summ.pending_balance)}</p>
         </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-4 text-center">
             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Qty Consumed</p>
             <p className="text-xs font-bold text-slate-700">{summ.total_litres} L</p>
          </div>
          <div className="p-4 text-center">
             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Monthly Bill</p>
             <p className="text-xs font-bold text-slate-700">{formatCurrency(summ.current_bill)}</p>
          </div>
          <div className="p-4 text-center">
             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Received</p>
             <p className="text-xs font-bold text-emerald-600">{formatCurrency(summ.total_paid)}</p>
          </div>
      </div>

      {/* Screen View */}
      <div className="p-0 border-t border-slate-100 print:hidden">
        <table className="w-full text-left border-collapse">
          <TableHeader />
          <tbody className="divide-y divide-slate-50">
            {displayEntries.map(renderRow)}
          </tbody>
        </table>
        {summ.daily_entries.length > 5 && (
          <button 
             onClick={() => setExpanded(!expanded)}
             className="w-full py-3 text-[10px] bg-slate-50 font-bold text-[#1e1b4b] uppercase tracking-widest hover:bg-slate-100 transition-colors border-t border-slate-100"
          >
             {expanded ? "Show Less" : `View All ${summ.daily_entries.length} Entries`}
          </button>
        )}
      </div>

      {/* Print View (Two Columns) */}
      <div className="hidden print:grid print:grid-cols-2 print:gap-x-4 print:p-0 print:border-t print:border-slate-100">
        <table className="w-full text-left border-collapse">
          <TableHeader />
          <tbody className="divide-y divide-slate-50">
            {leftCol.map(renderRow)}
          </tbody>
        </table>
        {rightCol.length > 0 && (
          <table className="w-full text-left border-collapse">
            <TableHeader />
            <tbody className="divide-y divide-slate-50">
              {rightCol.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>

       {/* QR & Footer */}
       <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between gap-6">
          <div className="flex-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Note</p>
            <p className="text-[9px] text-slate-500 italic leading-relaxed">
              Computer generated statement for {getMonthName(month)}. Please settle the due amount by 5th of next month. Thank you!
            </p>
          </div>
          {dynamicQr && (
            <div className="flex flex-col items-center">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Scan to pay: <span className="text-emerald-500 font-bold">{formatCurrency(summ.pending_balance)}</span></p>
              <img 
                src={dynamicQr} 
                alt="Pay QR" 
                className="w-16 h-16 border border-slate-100 p-0.5 rounded shadow-sm"
              />
            </div>
          )}
       </div>

      {/* Share Actions - Screen Only */}
      <div className="print:hidden grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50 border-b border-b-slate-200">
         <button 
            onClick={shareOnWhatsApp}
            className="py-4 flex flex-col items-center justify-center gap-1.5 hover:bg-emerald-50 text-emerald-600 transition-colors group"
         >
            <Share2 size={18} className="opacity-80 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold uppercase tracking-widest">WhatsApp</span>
         </button>
         <button 
            onClick={handleDownloadReport}
            className="py-4 flex flex-col items-center justify-center gap-1.5 hover:bg-indigo-50 text-[#1e1b4b] transition-colors group"
         >
            <Printer size={18} className="opacity-80 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Save PDF</span>
         </button>
      </div>
    </div>
  );
};

const Statement: React.FC = () => {
  const { customers, settings, loading, refreshCustomers } = useAppContext();

  useEffect(() => {
    refreshCustomers();
  }, []);
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customerSummaries, setCustomerSummaries] = useState<Record<string, MonthlySummary>>({});
  const [fetching, setFetching] = useState(false);

  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();

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
    const today = new Date();
    if (y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth() + 1)) return;
    setSelectedDate(new Date(y, m - 1));
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 print:bg-white print:pb-0 pt-[56px]">
      {/* 1. Header - Hidden on Print */}
      <div className="fixed left-1/2 -translate-x-1/2 max-w-lg top-0 w-full bg-white border-b border-slate-200 px-4 py-3 z-50 print:hidden flex items-center justify-between shadow-sm">
        <button onClick={() => navigate('/reports')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 shrink-0">
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex items-center px-1">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 shrink-0">
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col items-center min-w-[100px]">
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em]">Period</span>
             <span className="text-[11px] font-black text-[#1e1b4b] uppercase tracking-widest whitespace-nowrap">
                {getMonthName(month)} {year}
             </span>
          </div>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 shrink-0">
            <ChevronRight size={18} />
          </button>
        </div>

        <button 
          onClick={handlePrint}
          className="bg-[#1e1b4b] text-white px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 shrink-0"
        >
          <Printer size={14} />
          Print All
        </button>
      </div>

      {/* 2. Statements List */}
      <div className="px-4 pt-6 space-y-12 max-w-2xl mx-auto print:space-y-0 print:px-0 print:pt-0 print:max-w-none">
        {fetching ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e1b4b] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compiling Statements...</p>
          </div>
        ) : (
          customers.map((customer, idx) => {
            const summ = customerSummaries[customer.id];
            if (!summ || summ.daily_entries.length === 0) return null;

            return (
              <StatementCard
                key={customer.id}
                customer={customer}
                summ={summ}
                settings={settings}
                month={month}
                year={year}
              />
            );
          })
        )}
      </div>

      {!fetching && customers.length === 0 && (
        <div className="py-20 text-center text-slate-400">
           <Milk size={40} className="mx-auto mb-4 opacity-20" />
           <p className="text-xs font-bold uppercase tracking-widest">No customers found</p>
        </div>
      )}
    </div>
  );
};

export default Statement;
