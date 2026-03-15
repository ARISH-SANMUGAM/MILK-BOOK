import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Sun, 
  Moon, 
  CheckCircle2, 
  Save, 
  Minus,
  Plus,
  Truck,
  Users,
  Milk,
  LayoutGrid,
  Search,
  Check,
  User,
  Home,
  Clock,
  BarChart3,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { saveBatchDailyRecords, getDailyRecord } from '../services/db';
import { formatDate, calcDailyAmount } from '../utils/calculations';

interface SessionEntry { qty: number; collected: boolean; noDelivery: boolean }

const Delivery: React.FC = () => {
  const { customers, settings, loading, refreshCustomers } = useAppContext();
  const [date, setDate] = useState(formatDate(new Date(), 'iso'));
  const [activeSession, setActiveSession] = useState<'morning' | 'evening'>('morning');
  const [sessionData, setSessionData] = useState<Record<string, { morning: SessionEntry, evening: SessionEntry }>>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Load existing records or defaults for the date
  useEffect(() => {
    const loadSessionData = async () => {
      const newData: Record<string, any> = {};
      for (const c of customers) {
        const rec = await getDailyRecord(c.id, date);
        if (rec) {
          newData[c.id] = {
            morning: { qty: rec.morning_qty, collected: rec.morning_collected, noDelivery: rec.no_delivery },
            evening: { qty: rec.evening_qty, collected: rec.evening_collected, noDelivery: rec.no_delivery }
          };
        } else {
          newData[c.id] = {
            morning: { qty: c.default_qty || 0, collected: false, noDelivery: false },
            evening: { qty: c.default_qty || 0, collected: false, noDelivery: false }
          };
        }
      }
      setSessionData(newData);
    };
    if (customers.length > 0) loadSessionData();
  }, [date, customers]);

  const updateEntry = async (custId: string, session: 'morning' | 'evening', field: string, value: any) => {
    // 1. Update local state for immediate UI feedback
    const currentData = sessionData[custId] || { 
      morning: { qty: 0, collected: false, noDelivery: false }, 
      evening: { qty: 0, collected: false, noDelivery: false } 
    };

    const updatedCustomerSession = {
      ...currentData,
      [session]: {
        ...currentData[session],
        [field]: value
      }
    };

    setSessionData(prev => ({
      ...prev,
      [custId]: updatedCustomerSession
    }));

    // 2. Auto-save to database (Individual record update)
    const { litres, amount } = calcDailyAmount(
      updatedCustomerSession.morning.qty, 
      updatedCustomerSession.evening.qty, 
      settings.rate
    );

    try {
      await saveBatchDailyRecords(date, [{
        customerId: custId,
        data: {
          morning_qty: updatedCustomerSession.morning.qty,
          morning_collected: updatedCustomerSession.morning.collected,
          evening_qty: updatedCustomerSession.evening.qty,
          evening_collected: updatedCustomerSession.evening.collected,
          total_litres: litres,
          daily_amount: amount,
          rate_per_litre: settings.rate,
          no_delivery: updatedCustomerSession.morning.noDelivery || updatedCustomerSession.evening.noDelivery
        }
      }]);
    } catch (err) {
      console.error("Auto-save error", err);
    }
  };

   // Global save removed in favor of auto-save per entry

  const shiftStats = useMemo(() => {
    let totalLitres = 0;
    let pendingMembers = 0;
    let entriesDone = 0;
    let skippedCount = 0;

    customers.forEach(c => {
      const data = sessionData[c.id]?.[activeSession];
      if (data) {
        if (data.noDelivery) {
          skippedCount++;
        } else {
          totalLitres += data.qty;
          if (data.qty === 0) pendingMembers++;
          else entriesDone++;
        }
      }
    });

    return { 
      totalLitres, 
      pendingMembers, 
      entriesDone, 
      skippedCount,
      percent: customers.length > 0 ? Math.round((entriesDone / customers.length) * 100) : 0 
    };
  }, [sessionData, activeSession, customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [customers, searchTerm]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F1F4FF] font-sans pb-32">
      {/* 1. Breadcrumb & Status */}
      <div className="px-6 py-10">
        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
          {formatDate(date, 'full')} | <span className="text-[#10b981]">{activeSession === 'morning' ? 'Morning' : 'Evening'} Batch</span>
        </p>
      </div>

      <div className="px-6 mb-8">
        <div className="bg-gradient-to-br from-[#1e1b4b] via-[#2d2a7a] to-[#3730a3] rounded-2xl p-7 text-white shadow-2xl shadow-indigo-900/30 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5">{activeSession} Session Overview</p>
              <h2 className="text-3xl font-bold tracking-tight text-white">{shiftStats.totalLitres.toFixed(1)} <span className="text-lg font-medium text-indigo-300">Liters</span></h2>
            </div>
            <div className="text-right">
               <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
               </div>
               <div className="mt-2 text-right">
                 <span className="text-xl font-bold text-white block leading-none">{shiftStats.percent}%</span>
                 <span className="text-[10px] font-bold text-indigo-200 tracking-wider uppercase">{shiftStats.entriesDone}/{customers.length} Done</span>
               </div>
            </div>
          </div>

          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-6 mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${shiftStats.percent}%` }}
              className="h-full bg-emerald-400 rounded-full"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-center flex-1">
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1.5">Delivered</p>
              <p className="text-lg font-bold text-white leading-none">{shiftStats.entriesDone}</p>
            </div>
            <div className="text-center flex-1 border-x border-white/10">
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1.5">Skipped</p>
              <p className="text-lg font-bold text-white leading-none">{shiftStats.skippedCount}</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1.5">Earnings</p>
              <p className="text-lg font-bold text-emerald-400 leading-none">₹{(shiftStats.totalLitres * settings.rate).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Session Toggle Section */}
      <div className="px-6 mb-8">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 block ml-1">Delivery Session</label>
        <div className="bg-slate-200/50 rounded-xl p-1 flex gap-1 border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveSession('morning')}
            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeSession === 'morning' ? 'bg-[#1e1b4b] text-white shadow-md' : 'text-slate-500'
            }`}
          >
            Morning
          </button>
          <button 
            onClick={() => setActiveSession('evening')}
            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeSession === 'evening' ? 'bg-[#1e1b4b] text-white shadow-md' : 'text-slate-500'
            }`}
          >
            Evening
          </button>
        </div>
      </div>

      {/* 5. Date & Search Bar */}
      <div className="px-6 grid grid-cols-2 gap-3 mb-6">
        <div className="relative">
          <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full pl-10 pr-3 py-3.5 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1e1b4b]/10 focus:border-[#1e1b4b]"
          />
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-3.5 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1e1b4b]/10 focus:border-[#1e1b4b]"
          />
        </div>
      </div>

      {/* 6. Customer Routing Cards */}
      <div className="px-5 space-y-3 pb-8">
        <AnimatePresence mode="popLayout">
          {filteredCustomers.map((c) => {
            const s = sessionData[c.id]?.[activeSession] || { qty: 0, collected: false, noDelivery: false };
            const isDone = s.qty > 0 || s.noDelivery;
            const initials = c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

            return (
              <motion.div 
                layout
                key={c.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-xl p-5 border transition-all relative ${
                  s.noDelivery ? 'border-rose-400 bg-rose-50/30' : 
                  s.qty > 0 ? 'border-slate-900/30 bg-indigo-50/30' : 'border-slate-900/30'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{c.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.address || 'Standard Route'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {initials}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className={`flex items-center bg-slate-50 rounded-xl border border-slate-100 p-1 ${s.noDelivery ? 'opacity-30 pointer-events-none' : ''}`}>
                    <button 
                      onClick={() => updateEntry(c.id, activeSession, 'qty', Math.max(0, s.qty - 0.5))}
                      className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-[#1e1b4b] transition-colors"
                    >
                      <Minus size={16} strokeWidth={2.5} />
                    </button>
                    <div className="w-12 text-center">
                      <span className="text-base font-bold text-slate-800 tabular-nums">{s.qty}</span>
                    </div>
                    <button 
                      onClick={() => updateEntry(c.id, activeSession, 'qty', s.qty + 0.5)}
                      className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-[#1e1b4b] transition-colors"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>

                   <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => updateEntry(c.id, activeSession, 'noDelivery', !s.noDelivery)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                        s.noDelivery 
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md' 
                        : isDone
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {s.noDelivery ? 'Skipped' : isDone ? 'Delivered' : 'Pending'}
                    </button>
                    {isDone && !s.noDelivery && (
                      <div className="flex items-center gap-1.5 opacity-60">
                         <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Entry Saved</span>
                         <CheckCircle2 size={10} className="text-emerald-600" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

         <div className="pt-2 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              All Changes Auto-Synced to Cloud
            </p>
         </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-emerald-600 text-white px-6 py-3.5 rounded-xl shadow-2xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 border border-emerald-500"
          >
            <CheckCircle2 size={18} />
            Database Updated
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Delivery;
