import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  QrCode, 
  Database, 
  Info, 
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Cloud,
  Milk,
  User,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { saveSettings } from '../services/db';

const Settings: React.FC = () => {
  const { settings, setSettings, logout } = useAppContext();
  const [formData, setFormData] = useState({ ...settings, upiId: settings.upiId || '' });
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'system'>('profile');
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const isInitialMount = useRef(true);

  // Auto-save logic
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await saveSettings(formData);
        setSettings(formData);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } catch (err) {
        console.error("Auto-save failed:", err);
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [formData]);

  return (
    <div className="min-h-screen bg-[#F1F4FF] font-sans pb-32 pt-[72px]">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[3000] bg-emerald-600 text-white px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-bold text-xs uppercase tracking-widest"
          >
            <ShieldCheck size={18} strokeWidth={2.5} />
            Settings Updated Successfully
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Page Title - Fixed Header */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 max-w-lg w-full bg-[#F1F4FF]/80 backdrop-blur-md z-[100] px-6 py-4 flex items-center justify-between border-b border-indigo-100 shadow-sm">
         <h1 className="text-xl font-bold text-[#1e1b4b]">Settings</h1>
          <div className="flex items-center gap-3">
            {saving ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <RefreshCw className="animate-spin" size={12} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Saving...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <ShieldCheck size={12} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Saved</span>
              </div>
            )}
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (window.confirm("Are you sure you want to logout?")) logout();
              }}
              className="w-10 h-10 bg-white text-slate-500 rounded-full flex items-center justify-center border border-indigo-100 shadow-sm transition-all active:bg-slate-50"
            >
              <User size={20} />
            </motion.button>
          </div>
      </div>

      <div className="px-6 py-8">


        {/* Navigation Tabs */}
        <div className="flex bg-white rounded-xl p-1.5 border border-indigo-200 shadow-sm mb-8 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'Identity', icon: Building2 },
            { id: 'billing', label: 'Payment', icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap px-4 ${
                activeTab === tab.id 
                  ? 'bg-[#1e1b4b] text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <section className="bg-white rounded-2xl p-6 border border-slate-900/10 space-y-6">
                   <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Company Name</label>
                    <div className="relative">
                       <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                        id="tour-business-name"
                        maxLength={50}
                        type="text"
                        value={formData.businessName}
                        placeholder="e.g. PureMilk Dairy" 
                        onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Office Address</label>
                    <div className="relative">
                       <MapPin size={16} className="absolute left-4 top-4 text-slate-400" />
                       <textarea 
                        id="tour-business-address"
                        rows={3}
                        maxLength={100}
                        value={formData.address}
                        placeholder="Business address details..."
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none min-h-[100px]"
                      />
                    </div>
                  </div>
                </section>

                <div className="bg-gradient-to-br from-[#1e1b4b] to-[#1e1b4b]/90 text-white p-6 rounded-2xl shadow-xl shadow-indigo-900/20">
                   <div className="flex gap-4">
                     <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-indigo-400 border border-white/10">
                        <Cloud size={24} />
                     </div>
                     <div>
                        <h4 className="font-bold text-sm">Automated Cloud Backup</h4>
                        <p className="text-slate-400 text-[10px] font-medium uppercase mt-1 leading-relaxed">System state is synchronized with Firebase real-time nodes.</p>
                     </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <section className="bg-white rounded-2xl p-6 border border-slate-900/10 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Standard Milk Rate (₹/L)</label>
                      </div>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">₹</div>
                        <input 
                          id="tour-milk-rate"
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.rate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setFormData({
                              ...formData, 
                              rate: isNaN(val) ? 0 : val
                            });
                          }}
                          className="w-full pl-10 pr-4 py-4 rounded-xl text-2xl font-bold outline-none tabular-nums transition-all bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500"
                        />
                        <p className="mt-2 text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                          <Info size={12} /> You can update your selling rate anytime. Changes apply to all new entries.
                        </p>
                      </div>
                    </div>

                  <div className="space-y-4 border-t border-slate-50 pt-6">
                     <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Digital Payment Setup</label>
                     
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">UPI ID (VPA)</label>
                        <input 
                          id="tour-upi-id"
                          type="text"
                          value={formData.upiId}
                          placeholder="e.g. name@upi"
                          onChange={(e) => {
                            const upi = e.target.value;
                            setFormData({
                              ...formData, 
                              upiId: upi,
                              paymentQr: upi ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${upi}&pn=${formData.businessName}&cu=INR`)}` : ''
                            });
                          }}
                          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                        />
                     </div>

                     {formData.paymentQr && (
                       <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
                          <img 
                            src={formData.paymentQr} 
                            alt="Payment QR" 
                            className="w-32 h-32 mx-auto border-4 border-slate-50 rounded-lg p-1"
                          />
                          <div>
                            <p className="text-xs text-[#1e1b4b] font-bold uppercase tracking-wider">Active UPI QR</p>
                            <p className="text-[9px] text-slate-400 font-medium mt-1">This will be printed on customer reports</p>
                          </div>
                       </div>
                     )}

                     {!formData.paymentQr && (
                       <div className="p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4">
                          <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto text-slate-300 border border-slate-100">
                             <QrCode size={28} />
                          </div>
                          <p className="text-[9px] text-slate-400 font-medium">Enter UPI ID above to generate QR</p>
                       </div>
                     )}
                  </div>
                </section>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

export default Settings;
