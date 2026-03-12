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
  Check
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { saveDailyRecord, getDailyRecord } from '../services/db';
import { formatDate, calcDailyAmount } from '../utils/calculations';

interface SessionEntry { qty: number; collected: boolean; noDelivery: boolean }

const Delivery: React.FC = () => {
  const { customers, settings, loading } = useAppContext();
  const [date, setDate] = useState(formatDate(new Date(), 'iso'));
  const [activeSession, setActiveSession] = useState<'morning' | 'evening'>('morning');
  const [sessionData, setSessionData] = useState<Record<string, { morning: SessionEntry, evening: SessionEntry }>>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Load existing records for the date
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
            morning: { qty: 0, collected: false, noDelivery: false },
            evening: { qty: 0, collected: false, noDelivery: false }
          };
        }
      }
      setSessionData(newData);
    };
    if (customers.length > 0) loadSessionData();
  }, [date, customers]);

  const updateEntry = (custId: string, session: 'morning' | 'evening', field: string, value: any) => {
    setSessionData(prev => ({
      ...prev,
      [custId]: {
        ...prev[custId],
        [session]: {
          ...prev[custId][session],
          [field]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const c of customers) {
        const s = sessionData[c.id];
        const { litres, amount } = calcDailyAmount(s.morning.qty, s.evening.qty, settings.rate);
        
        await saveDailyRecord(c.id, date, {
          morning_qty: s.morning.qty,
          morning_collected: s.morning.collected,
          evening_qty: s.evening.qty,
          evening_collected: s.evening.collected,
          total_litres: litres,
          daily_amount: amount,
          rate_per_litre: settings.rate,
          no_delivery: s.morning.noDelivery || s.evening.noDelivery
        });
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to save entries.");
    } finally {
      setSaving(false);
    }
  };

  // Shift Statistics
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

    return { totalLitres, pendingMembers, entriesDone, skippedCount };
  }, [sessionData, activeSession, customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [customers, searchTerm]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Route...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32 relative overflow-hidden">
      {/* Revised Header with integrated background */}
      <header className={`px-5 pt-8 pb-32 transition-colors duration-700 ${
        activeSession === 'morning' ? 'bg-amber-400' : 'bg-indigo-600'
      }`}>
        <div className="flex items-start justify-between">
          <div className="text-white">
            <h1 className="text-3xl font-black tracking-tight leading-tight text-white">Daily Entry</h1>
            <div className="flex items-center gap-2 mt-1">
              <Calendar size={14} className="text-white" />
              <p className="text-xs font-black uppercase tracking-widest text-white leading-none">{formatDate(date, 'short')}</p>
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            disabled={saving}
            onClick={handleSave}
            className="bg-black text-white px-5 py-2.5 rounded-xl shadow-xl active:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-gray-100 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
            <span className="text-[10px] font-black uppercase tracking-widest">Save</span>
          </motion.button>
        </div>
      </header>

      {/* Stats Dashboard - Shifting it up to overlap the header */}
      <div className="px-5 -mt-24 space-y-6 relative z-10">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-black/5 border border-white/50 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex bg-gray-100/80 p-1 rounded-2xl w-fit">
              <button 
                onClick={() => setActiveSession('morning')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeSession === 'morning' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Sun size={14} fill={activeSession === 'morning' ? "currentColor" : "none"} /> Morning
              </button>
              <button 
                onClick={() => setActiveSession('evening')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeSession === 'evening' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Moon size={14} fill={activeSession === 'evening' ? "currentColor" : "none"} /> Evening
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl border border-gray-300">
               <Calendar size={14} className="text-gray-900" />
               <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none p-0 outline-none text-xs font-black text-black w-24"
               />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 text-blue-900 rounded-xl flex items-center justify-center mx-auto mb-2 border border-blue-200">
                <Milk size={18} strokeWidth={3} />
              </div>
              <p className="text-[18px] font-black text-black leading-none">{shiftStats.totalLitres.toFixed(1)}</p>
              <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest mt-1">Total Litres</p>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="w-10 h-10 bg-rose-100 text-rose-900 rounded-xl flex items-center justify-center mx-auto mb-2 border border-rose-200">
                <Users size={18} strokeWidth={3} />
              </div>
              <p className="text-[18px] font-black text-black leading-none">{shiftStats.pendingMembers}</p>
              <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest mt-1">Pending</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-900 rounded-xl flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                <CheckCircle2 size={18} strokeWidth={3} />
              </div>
              <p className="text-[18px] font-black text-black leading-none">{shiftStats.entriesDone}</p>
              <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest mt-1">Logged</p>
            </div>
          </div>
        </div>

        <div className="relative group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text"
            placeholder="Search Route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-300 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-blue-100/50 outline-none font-black text-black transition-all placeholder:text-gray-900/40"
          />
        </div>

        {/* Customer List */}
        <div className="space-y-3 pb-20">
          <AnimatePresence mode="popLayout">
            {filteredCustomers.map((c) => {
              const s = sessionData[c.id]?.[activeSession] || { qty: 0, collected: false, noDelivery: false };
              const isLogged = s.qty > 0 || s.noDelivery;
              
              return (
                <motion.div 
                  layout
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white p-5 rounded-[2rem] border-2 transition-all duration-300 ${
                    s.noDelivery 
                      ? 'border-gray-200 bg-gray-50/50 grayscale' 
                      : isLogged 
                        ? 'border-blue-200 shadow-blue-100 shadow-xl' 
                        : 'border-gray-100 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${
                        activeSession === 'morning' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-gray-900 text-base tracking-tight">{c.name}</h4>
                          {isLogged && (
                            <div className="bg-emerald-500 p-1 rounded-full text-white">
                              <Check size={8} strokeWidth={4} />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-black font-black uppercase tracking-widest mt-0.5">Usual: {c.default_qty}L</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`flex items-center p-1.5 rounded-2xl transition-all ${
                        s.noDelivery ? 'opacity-20 pointer-events-none' : 'bg-gray-100 border border-gray-300 shadow-inner'
                      }`}>
                        <button 
                          onClick={() => updateEntry(c.id, activeSession, 'qty', Math.max(0, s.qty - 0.5))}
                          className="w-10 h-10 flex items-center justify-center text-black hover:text-rose-700 active:scale-90 transition-all bg-white rounded-xl shadow-sm border border-gray-200"
                        >
                          <Minus size={18} strokeWidth={4} />
                        </button>
                        <div className="w-14 text-center">
                          <span className={`text-xl font-black tabular-nums ${s.qty > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                            {s.qty === 0 ? '0' : s.qty}
                          </span>
                          <span className="text-[10px] font-black text-black uppercase block leading-none">Liters</span>
                        </div>
                        <button 
                          onClick={() => updateEntry(c.id, activeSession, 'qty', s.qty + 0.5)}
                          className="w-10 h-10 flex items-center justify-center text-black hover:text-emerald-700 active:scale-90 transition-all bg-white rounded-xl shadow-sm border border-gray-200"
                        >
                          <Plus size={18} strokeWidth={4} />
                        </button>
                      </div>

                      {/* No Delivery Switch */}
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateEntry(c.id, activeSession, 'noDelivery', !s.noDelivery)}
                        className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all ${
                          s.noDelivery 
                            ? 'bg-rose-600 border-rose-700 text-white shadow-lg shadow-rose-200' 
                            : 'bg-white border-gray-300 text-gray-400 hover:border-black hover:text-black shadow-md'
                        }`}
                      >
                        <Truck size={22} fill={s.noDelivery ? "white" : "none"} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredCustomers.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-50 text-gray-200">
                <LayoutGrid size={32} />
              </div>
              <p className="text-gray-400 font-extrabold uppercase text-[10px] tracking-widest leading-relaxed px-10">No customer found on this route</p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-xs"
          >
            <div className="bg-gray-900 p-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-white/10">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white tracking-tight">Records Synced</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Cloud Database Updated</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Delivery;
