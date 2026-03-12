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
  BarChart3
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black">{settings.businessName}</h1>
          <p className="text-[10px] text-gray-900 font-black uppercase tracking-[0.2em] mt-1">Dashboard Overview</p>
        </div>
        <div className="flex items-center bg-white border border-gray-300 rounded-xl px-2 py-1.5 shadow-sm">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-black">
            <ChevronLeft size={18} strokeWidth={3} />
          </button>
          <span className="px-3 text-xs font-black uppercase tracking-wider text-black min-w-[120px] text-center">
            {getMonthName(month)} {year}
          </span>
          <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-black">
            <ChevronRight size={18} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 transform group-hover:scale-110 transition-transform">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <p className="text-blue-100 text-sm font-medium mb-1">Total Revenue</p>
            <h2 className="text-3xl font-extrabold">{formatCurrency(stats.revenue)}</h2>
            <div className="mt-4 flex items-center text-xs bg-white/10 w-fit px-2 py-1 rounded-full border border-white/5">
              <span>Updated just now</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2.5 bg-sky-100 text-sky-900 rounded-2xl border border-sky-200">
                <Droplets size={20} strokeWidth={3} />
              </div>
            </div>
            <div>
              <p className="text-black text-[9px] font-black uppercase tracking-widest mb-1">Total Quantity</p>
              <h3 className="text-xl font-black text-black">{stats.litres.toFixed(1)} <span className="text-[10px] font-black uppercase">Litres</span></h3>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-md flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-2xl border border-emerald-200">
                <Wallet size={20} strokeWidth={3} />
              </div>
            </div>
            <div>
              <p className="text-black text-[9px] font-black uppercase tracking-widest mb-1">Collected</p>
              <h3 className="text-xl font-black text-black">{formatCurrency(stats.collected)}</h3>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick Actions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-widest">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/" className="flex items-center gap-3 p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm hover:border-black transition-all group active:scale-[0.98]">
            <div className="p-2 bg-blue-100 text-blue-900 rounded-xl group-hover:bg-black group-hover:text-white transition-colors border border-blue-200">
              <Plus size={20} strokeWidth={3} />
            </div>
            <span className="font-black text-black text-xs uppercase tracking-tight">New Entry</span>
          </Link>
          <Link to="/reports" className="flex items-center gap-3 p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm hover:border-black transition-all group active:scale-[0.98]">
            <div className="p-2 bg-emerald-100 text-emerald-900 rounded-xl group-hover:bg-black group-hover:text-white transition-colors border border-emerald-200">
              <BarChart3 size={20} strokeWidth={3} />
            </div>
            <span className="font-black text-black text-xs uppercase tracking-tight">Analytics</span>
          </Link>
        </div>
      </section>

      {/* Recent Activity / Active Customers */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-widest">Active Customers</h3>
          <Link to="/customers" className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
            View All <ArrowRight size={14} />
          </Link>
        </div>
        
        <div className="space-y-3">
          {customers.slice(0, 5).map((customer) => (
            <motion.div 
              key={customer.id}
              whileHover={{ scale: 1.01 }}
              className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-md flex items-center justify-between active:border-black transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center font-black text-black text-sm">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-black text-sm">{customer.name}</h4>
                  <p className="text-[10px] text-gray-900 font-black uppercase tracking-wider">{customer.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest mb-0.5">Current Due</p>
                <p className={`font-black text-base ${customer.total_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {formatCurrency(customer.total_balance)}
                </p>
              </div>
            </motion.div>
          ))}
          {customers.length === 0 && (
            <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 text-sm font-medium">No customers added yet.</p>
              <Link to="/customers" className="text-blue-600 text-xs font-bold mt-2 inline-block">Add your first customer</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
