import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Key, Mail, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const UserMenu: React.FC = () => {
  const { user, logout } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handlePasswordReset = async () => {
    if (!user?.email || isSending || resetSent) return;
    
    setIsSending(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
      // Keep "Sent" state for a while
      setTimeout(() => {
        setResetSent(false);
        setIsSending(false);
      }, 10000); // 10 seconds for user to notice
    } catch (err) {
      console.error("Reset failed", err);
      alert("Failed to send reset email. Please try again later.");
      setIsSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-white text-slate-500 rounded-full flex items-center justify-center border border-indigo-100 shadow-sm transition-all active:bg-slate-50"
      >
        <User size={20} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[150] bg-slate-900/20 backdrop-blur-[2px]"
            />

            {/* Dropdown */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10, x: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10, x: 20 }}
              className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[160] overflow-hidden"
            >
              {/* Profile Brief */}
              <div className="p-4 border-b border-slate-50 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                    <User size={16} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Info</span>
                </div>
                <p className="text-xs font-bold text-slate-700 truncate flex items-center gap-2">
                  <Mail size={12} className="text-slate-400" />
                  {user.email}
                </p>
              </div>

              <div className="p-1 space-y-1">
                <button 
                  disabled={isSending || resetSent}
                  onClick={handlePasswordReset}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group text-left ${
                    resetSent ? 'bg-emerald-50 text-emerald-600' : 
                    isSending ? 'bg-indigo-200/20 text-indigo-400 opacity-70' :
                    'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    resetSent ? 'bg-emerald-500 text-white' : 
                    isSending ? 'bg-indigo-300 text-white animate-pulse' :
                    'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                  }`}>
                    <Key size={14} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${resetSent ? 'text-emerald-700' : ''}`}>
                      {resetSent ? 'Reset Links Ready' : isSending ? 'Sending Link...' : 'Change Password'}
                    </p>
                    <p className={`text-[8px] font-bold ${resetSent ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {resetSent ? 'Check your email inbox!' : isSending ? 'Please wait...' : 'Send reset link to email'}
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to logout?")) {
                      logout();
                      setIsOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors group text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <LogOut size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider">Sign Out</p>
                    <p className="text-[8px] text-rose-400 font-bold">Close session</p>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2 flex items-center justify-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-500 transition-colors mt-1"
              >
                <X size={12} />
                Close Menu
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserMenu;
