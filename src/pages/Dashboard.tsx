import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Droplets, 
  Wallet, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  ArrowRight,
  BarChart3,
  Milk,
  User,
  LayoutGrid
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getMonthName, formatCurrency, getPrevMonth, getNextMonth } from '../utils/calculations';
import { getMonthlySummary } from '../services/db';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { settings, customers, loading } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState({
    revenue: 0,
    litres: 0,
    collected: 0,
    due: 0
  });
  
  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();

  useEffect(() => {
    const calculateStats = async () => {
      let revenue = 0;
      let litres = 0;
      let collected = 0;
      let due = 0;

      for (const c of customers) {
        const summ = await getMonthlySummary(c.id, year, month);
        if (summ) {
          revenue += summ.current_bill || 0;
          litres += summ.total_litres || 0;
          collected += summ.total_paid || 0;
        }
        due += c.total_balance || 0;
      }
      setStats({ revenue, litres, collected, due });
    };

    if (!loading && customers.length > 0) {
      calculateStats();
    }
  }, [customers, loading, month, year]);

  const handlePrevMonth = () => {
    const { m, y } = getPrevMonth(month, year);
    setSelectedDate(new Date(y, m - 1));
  };

  const handleNextMonth = () => {
    const { m, y } = getNextMonth(month, year);
    setSelectedDate(new Date(y, m - 1));
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F0F2FF] font-sans pb-32">
      {/* 1. Month Selector */}
      <div className="px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">Monthly Overview</h1>
          <div className="flex items-center bg-white rounded-full p-1 border border-indigo-200 shadow-sm">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-[#3E3D7B]">
              <ChevronLeft size={20} strokeWidth={4} />
            </button>
            <span className="px-4 text-[11px] font-black uppercase tracking-widest text-[#1A1A1A] min-w-[140px] text-center">
              {getMonthName(month)} {year}
            </span>
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-[#3E3D7B]">
              <ChevronRight size={20} strokeWidth={4} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Stats Card */}
      <div className="px-5 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1e1b4b] via-[#2d2a7a] to-[#3730a3] rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-900/30 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp size={100} />
          </div>
          <div className="relative z-10">
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Monthly Revenue</p>
            <h2 className="text-4xl font-black tracking-tighter mb-8 italic">{formatCurrency(stats.revenue)}</h2>
            
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
              <div>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-wider mb-1">Litres Sold</p>
                <p className="text-xl font-black">{stats.litres.toFixed(1)}L</p>
              </div>
              <div>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-wider mb-1">Payments Collected</p>
                <p className="text-xl font-black">{formatCurrency(stats.collected)}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. Secondary Stats Grid */}
      <div className="px-6 mb-10">
        <h3 className="text-[13px] font-black text-[#1A1A1A] uppercase tracking-widest mb-4 opacity-40">Portfolio Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-[2rem] border border-indigo-700 shadow-lg shadow-indigo-900/20 flex flex-col items-center">
            <div className="w-10 h-10 bg-white/20 text-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
              <User size={20} strokeWidth={3} />
            </div>
            <p className="text-[18px] font-black text-white mb-1">{customers.length}</p>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-tighter">Total Members</p>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-[2rem] border border-rose-600 shadow-lg shadow-rose-900/20 flex flex-col items-center">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-4">
              <Wallet size={24} />
            </div>
            <p className="text-[18px] font-black text-white mb-1">{formatCurrency(stats.due)}</p>
            <p className="text-[10px] font-bold text-rose-200 uppercase tracking-tighter">Outstanding Due</p>
          </div>
        </div>
      </div>

      {/* 5. Active Route section */}
      <section className="px-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[13px] font-black text-[#1A1A1A] uppercase tracking-widest opacity-40">Active Route</h3>
          <Link to="/customers" className="bg-[#1e1b4b] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md shadow-indigo-900/30">
            View All
          </Link>
        </div>
        
        <div className="space-y-4">
          {customers.slice(0, 4).map((customer) => {
            const initials = customer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            return (
              <motion.div 
                key={customer.id}
                whileTap={{ scale: 0.98 }}
                className="bg-white p-5 rounded-[2rem] border border-indigo-100 shadow-sm shadow-indigo-900/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-[#1e1b4b] rounded-full flex items-center justify-center font-black text-[12px] border border-indigo-200">
                    {initials}
                  </div>
                  <div>
                    <h4 className="font-black text-[#1A1A1A] text-base leading-tight">{customer.name}</h4>
                    <p className="text-[11px] font-bold text-[#AFAFAF] mt-0.5">{customer.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-[#AFAFAF] uppercase tracking-widest mb-1.5">Balance</p>
                  <p className={`font-black text-[15px] ${customer.total_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(customer.total_balance)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
