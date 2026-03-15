import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  IndianRupee, 
  QrCode, 
  Database, 
  Info, 
  Smartphone,
  Save,
  LogOut,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Cloud,
  Milk,
  User,
  ArrowRight
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { saveSettings } from '../services/db';

const Settings: React.FC = () => {
  const { settings, setSettings } = useAppContext();
  const [formData, setFormData] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'system'>('profile');
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(formData);
      setSettings(formData);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const clearCache = () => {
    if (window.confirm("This will clear local storage. Your data in Firebase is safe but you'll need to re-login/re-sync. Continue?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F4FF] font-sans pb-32">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-bold text-xs uppercase tracking-widest"
          >
            <ShieldCheck size={18} strokeWidth={2.5} />
            Settings Updated Successfully
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Page Content area */}
      <div className="px-6 py-10">
        <div className="flex items-center justify-between mb-8">
           <h1 className="text-2xl font-bold text-[#1e1b4b]">Settings</h1>
           <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSubmit()}
              disabled={saving}
              className="bg-[#1e1b4b] text-white px-5 py-2.5 rounded-xl shadow-xl shadow-indigo-100 active:bg-[#2e2b5b] disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              <span className="text-[10px] font-bold uppercase tracking-widest">Update</span>
            </motion.button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white rounded-xl p-1.5 border border-indigo-200 shadow-sm mb-8 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'Identity', icon: Building2 },
            { id: 'billing', label: 'Payment', icon: CreditCard },
            { id: 'system', label: 'Core', icon: Database },
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
                        rows={3}
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
                   <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Standard Milk Rate (₹/L)</label>
                    <div className="relative">
                       <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">₹</div>
                       <input 
                        type="number"
                        value={formData.rate}
                        onChange={(e) => setFormData({...formData, rate: parseFloat(e.target.value)})}
                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-bold text-slate-800 outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-slate-50 pt-6">
                     <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Digital Payment Setup</label>
                     <div className="p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4 group hover:bg-white hover:border-indigo-500/30 transition-all">
                        <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto text-slate-300 group-hover:text-indigo-600 border border-slate-100 transition-colors">
                           <QrCode size={28} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-700 font-bold uppercase tracking-wider">UPI QR Code</p>
                          <p className="text-[9px] text-slate-400 font-medium mt-1">Configure your receiving account QR profile</p>
                        </div>
                     </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                   <button 
                    onClick={clearCache}
                    className="w-full flex items-center justify-between p-6 hover:bg-rose-50 transition-all group border-b border-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all shadow-sm">
                        <RefreshCw size={20} strokeWidth={2.5} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 text-sm">Purge Local Cache</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Reset application state</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>

                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center">
                        <Info size={20} strokeWidth={2.5} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 text-sm">System Build</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">MilkBook Enterprise v2.0</p>
                      </div>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-slate-200">Stable</span>
                  </div>
                </div>

                <div className="p-10 text-center opacity-40">
                   <Milk className="mx-auto text-slate-400 mb-2" size={32} />
                   <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">Service provided by Antigravity</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-24 left-0 right-0 p-6 z-[100] flex justify-center pointer-events-none">
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSubmit()}
          disabled={saving}
          className="w-full max-w-sm py-4 bg-gradient-to-r from-[#1e1b4b] to-[#2e2a75] text-white rounded-xl shadow-2xl shadow-indigo-900/40 flex items-center justify-center gap-3 pointer-events-auto transition-all disabled:opacity-50 border border-white/10"
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
            {saving ? "Updating..." : "Save Changes"}
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default Settings;
