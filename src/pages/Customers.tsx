import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  UserPlus, 
  MoreVertical, 
  Phone, 
  MapPin, 
  Trash2, 
  Edit2,
  X,
  Users,
  Milk,
  User,
  Check,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { saveCustomer, deleteCustomer, Customer } from '../services/db';
import { formatCurrency } from '../utils/calculations';

const Customers: React.FC = () => {
  const { customers, refreshCustomers, loading, logout } = useAppContext();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    total_balance: 0
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        total_balance: customer.total_balance || 0
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '', total_balance: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Phone validation (Indian standard: 10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      alert("Please enter a valid 10-digit Indian phone number.");
      return;
    }

    // Name validation
    if (formData.name.trim().length > 50) {
      alert("Name should be under 50 characters.");
      return;
    }

    // Duplicate checks
    const isDuplicateName = customers.find(c => c.id !== editingCustomer?.id && c.name.toLowerCase() === formData.name.toLowerCase());
    const isDuplicatePhone = customers.find(c => c.id !== editingCustomer?.id && c.phone === formData.phone);

    if (isDuplicateName) {
      alert("A member with this name already exists.");
      return;
    }
    if (isDuplicatePhone) {
      alert("A member with this phone number already exists.");
      return;
    }

    await saveCustomer({
      id: editingCustomer?.id,
      ...formData
    });
    setIsModalOpen(false);
    refreshCustomers();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this customer? This will also remove their history.")) {
      await deleteCustomer(id);
      refreshCustomers();
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F1F4FF] font-sans pb-32 pt-[80px]">
      {/* 1. Page Title & Action Area - Fixed */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 max-w-lg w-full bg-[#F1F4FF]/80 backdrop-blur-md z-[100] px-6 py-4 flex items-center justify-between shadow-sm border-b border-indigo-100">
        <div>
          <h1 className="text-xl font-bold text-[#1e1b4b]">Customers</h1>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">{customers.length} Members</p>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (window.confirm("Are you sure you want to logout?")) logout();
          }}
          className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center border border-slate-200 shadow-sm"
        >
          <User size={20} />
        </motion.button>
      </div>

      <div className="px-6 py-4">


        {/* Search & Add Area */}
        <div className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-900/30 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
            />
          </div>
          <motion.button 
            id="tour-add-customer"
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="aspect-square bg-[#1e1b4b] text-white p-3 rounded-xl shadow-lg flex items-center justify-center"
          >
            <Plus size={24} strokeWidth={3} />
          </motion.button>
        </div>

        {/* Customer Directory */}
        <div className="space-y-3">
          {filteredCustomers.map((c) => {
            const initials = c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            return (
              <motion.div 
                layout
                key={c.id}
                className="bg-white p-5 rounded-xl border border-slate-900/30 flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-600">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 leading-tight truncate">{c.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Phone size={10} /> {c.phone}
                      </p>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin size={10} /> {c.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <div className="text-right mr-3 hidden sm:block">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending to Pay</p>
                    <p className={`text-sm font-bold ${c.total_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatCurrency(c.total_balance)}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleOpenModal(c)}
                    className="p-2.5 text-slate-400 hover:text-[#1e1b4b] hover:bg-slate-50 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(c.id)}
                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
          
          {filteredCustomers.length === 0 && !loading && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-300">
                 <Users size={32} />
              </div>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No matching records found</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              id="tour-customer-modal"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h2 className="text-lg font-bold text-slate-800">
                    {editingCustomer ? 'Modify Account' : 'Register Customer'}
                  </h2>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                   <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                      <input 
                        required
                        type="text" 
                        maxLength={50}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:bg-white focus:border-[#1e1b4b] outline-none transition-all font-semibold text-slate-700"
                        placeholder="Customer name"
                      />
                   </div>
                       <div className="space-y-1.5 col-span-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contact Number</label>
                         <input 
                          required
                          type="tel" 
                          maxLength={10}
                          value={formData.phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val.length <= 10) setFormData({...formData, phone: val});
                          }}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:bg-white focus:border-[#1e1b4b] outline-none transition-all font-semibold text-slate-700"
                          placeholder="Phone number (10 digits)"
                        />
                      </div>
                   <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Delivery Address</label>
                       <textarea 
                        required
                        maxLength={200}
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-semibold text-slate-700 h-24 resize-none"
                        placeholder="Street address (max 200 chars)..."
                      />
                   </div>
                   {/* Balance adjustment removed */}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#1e1b4b] to-[#2e2a75] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-indigo-900/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={18} strokeWidth={3} />
                    {editingCustomer ? 'Update Account' : 'Register Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;
