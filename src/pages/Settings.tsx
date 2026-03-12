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
  Cloud
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
    <div className="min-h-screen bg-gray-50/50 p-5 pb-24 space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
          >
            <ShieldCheck size={20} />
            Settings Savied!
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tight">Settings</h1>
          <p className="text-[10px] text-gray-900 font-black uppercase tracking-[0.2em] mt-1">Configuration</p>
        </div>
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSubmit()}
          disabled={saving}
          className="bg-black text-white px-5 py-2.5 rounded-xl shadow-xl active:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
          <span className="text-[10px] font-black uppercase tracking-widest">Done</span>
        </motion.button>
      </header>

      {/* Modern Tabs */}
      <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
        {[
          { id: 'profile', label: 'Profile', icon: Building2 },
          { id: 'billing', label: 'Billing', icon: CreditCard },
          { id: 'system', label: 'System', icon: Database },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap px-4 ${
              activeTab === tab.id 
                ? 'bg-black text-white shadow-xl' 
                : 'text-gray-900 hover:bg-gray-100'
            }`}
          >
            <tab.icon size={16} />
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
        >
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2 mb-1">
                    <Building2 size={12} strokeWidth={3} className="text-black" /> Business Identity
                  </label>
                  <input 
                    type="text"
                    value={formData.businessName}
                    placeholder="Enter Business Name"
                    onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-black text-black placeholder:text-gray-900/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2 mb-1">
                    <MapPin size={12} strokeWidth={3} className="text-black" /> Location / Address
                  </label>
                  <textarea 
                    rows={3}
                    value={formData.address}
                    placeholder="Shop address for receipts..."
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-black text-sm text-black resize-none placeholder:text-gray-900/40"
                  />
                </div>
              </section>

              <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100/50">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Cloud size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">Cloud Sync Enabled</h4>
                    <p className="text-blue-600/70 text-xs mt-1">All changes are automatically backed up to your Firebase secure storage.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-4">
              <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2 mb-1">
                    <IndianRupee size={12} strokeWidth={3} className="text-emerald-700" /> Default Milk Rate
                  </label>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-emerald-900 group-focus-within:text-emerald-500 transition-colors text-lg">₹</span>
                    <input 
                      type="number"
                      value={formData.rate}
                      onChange={(e) => setFormData({...formData, rate: parseFloat(e.target.value)})}
                      className="w-full pl-10 pr-5 py-5 bg-white border border-emerald-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 transition-all font-black text-2xl text-emerald-900 shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-gray-50 pt-6">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                    <QrCode size={12} className="text-blue-500" /> UPI QR Code
                  </label>
                  
                  <div className="p-8 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 text-center space-y-4 group hover:bg-white hover:border-blue-400 transition-all cursor-pointer">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto text-gray-400 group-hover:text-blue-500 transition-colors">
                       <Smartphone size={32} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-900 font-bold">Upload QR Code</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">JPG or PNG. Max 5MB</p>
                    </div>
                    <button type="button" className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-black text-gray-700 shadow-sm">Browse Files</button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
                <button 
                  onClick={clearCache}
                  className="w-full flex items-center justify-between p-5 hover:bg-rose-50 transition-all group border-b border-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-100 text-rose-900 rounded-2xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all border border-rose-200">
                      <RefreshCw size={22} strokeWidth={3} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-black text-sm">Purge Local Storage</h4>
                      <p className="text-[10px] text-gray-900 font-black uppercase tracking-wider mt-0.5">Reset cache & Sync</p>
                    </div>
                  </div>
                  <ChevronRight size={18} strokeWidth={3} className="text-black group-hover:text-rose-500" />
                </button>

                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center">
                      <Info size={22} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900 text-sm">App Version</h4>
                      <p className="text-xs text-gray-400 font-medium">Build 3.0.4-vRC</p>
                    </div>
                  </div>
                  <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Stable</span>
                </div>
              </div>

              <div className="p-10 text-center opacity-20">
                <img src="/logo192.png" alt="MilkBook" className="w-16 h-16 mx-auto grayscale grayscale-100" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-4 text-gray-900">MilkBook Enterprise</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="fixed bottom-20 left-0 right-0 p-4 z-[50] pointer-events-none">
        <motion.button 
          whileTap={{ scale: 0.97 }}
          onClick={() => handleSubmit()}
          disabled={saving}
          className="w-full max-w-xs mx-auto py-3.5 bg-black text-white font-black rounded-2xl shadow-2xl flex items-center justify-center gap-3 pointer-events-auto active:bg-gray-900 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          <span className="text-xs uppercase tracking-[0.15em]">
            {saving ? "Saving..." : "Commit Changes"}
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default Settings;
