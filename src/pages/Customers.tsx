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
  Users
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { saveCustomer, deleteCustomer, Customer } from '../services/db';
import { formatCurrency } from '../utils/calculations';

const Customers: React.FC = () => {
  const { customers, refreshCustomers, loading } = useAppContext();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    default_qty: 1,
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
        default_qty: customer.default_qty || 1,
        total_balance: customer.total_balance || 0
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '', default_qty: 1, total_balance: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (loading) return <div className="p-10 text-center text-gray-400">Loading Customers...</div>;

  return (
    <div className="p-5 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight">Customers</h1>
          <p className="text-[10px] text-gray-900 font-black uppercase tracking-[0.2em] mt-1">{customers.length} Subscribers</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
        >
          <UserPlus size={22} />
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-black">
          <Search size={18} strokeWidth={3} />
        </div>
        <input 
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-300 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400 transition-all text-sm font-black text-black placeholder:text-gray-900/40"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-4">
        {filteredCustomers.map((c) => (
          <motion.div 
            layout
            key={c.id}
            className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-md relative group overflow-hidden active:border-black transition-all"
          >
            <div className="flex justify-between items-start relative z-10">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-gray-100 text-black border border-gray-200 rounded-2xl flex items-center justify-center font-black text-lg">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-black text-base">{c.name}</h3>
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-900 font-black uppercase tracking-wider">
                      <Phone size={12} strokeWidth={3} className="text-black" /> {c.phone}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-900 font-extrabold line-clamp-1">
                      <MapPin size={12} strokeWidth={3} className="text-black" /> {c.address || 'No address provided'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-black text-gray-900">Balance</span>
                <p className={`font-black text-lg ${c.total_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {formatCurrency(c.total_balance)}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-900 font-black uppercase tracking-wider">Default Qty</span>
                  <span className="text-sm font-black text-black">{c.default_qty} Litres</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenModal(c)}
                  className="p-2 text-black hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all border border-gray-100"
                >
                  <Edit2 size={16} strokeWidth={3} />
                </button>
                <button 
                  onClick={() => handleDelete(c.id)}
                  className="p-2 text-black hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-gray-100"
                >
                  <Trash2 size={16} strokeWidth={3} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredCustomers.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-gray-200" />
            </div>
            <p className="text-gray-400 font-medium">No customers found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Full Name</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Phone Number</label>
                    <input 
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Default Qty (L)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={formData.default_qty}
                        onChange={(e) => setFormData({...formData, default_qty: parseFloat(e.target.value)})}
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Initial Balance (₹)</label>
                      <input 
                        type="number"
                        value={formData.total_balance}
                        onChange={(e) => setFormData({...formData, total_balance: parseFloat(e.target.value)})}
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-bold text-rose-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Address (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Street name, landmark..."
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all font-medium resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-black text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl shadow-xl hover:bg-gray-900 active:scale-[0.97] transition-all mt-6"
                  >
                    {editingCustomer ? 'Update Profile' : 'Create Account'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Customers;
