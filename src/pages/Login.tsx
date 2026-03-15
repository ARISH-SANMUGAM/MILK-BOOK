import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Milk,
  Eye,
  EyeOff
} from 'lucide-react';
import { auth, db } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    businessName: ''
  });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Initialize settings if user is new
      const settingsDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'config'));
      if (!settingsDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), {
          businessName: 'My Dairy',
          rate: 60,
          address: '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(result.user, { displayName: formData.name });
        
        // Initialize user settings
        await setDoc(doc(db, 'users', result.user.uid, 'settings', 'config'), {
          businessName: formData.businessName || 'My Dairy',
          rate: 60,
          address: '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F4FF] flex flex-col items-center justify-center px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#1e1b4b] to-[#3730a3] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-900/20 text-white">
            <Milk size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-[#1e1b4b] tracking-tight">MilkBook</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Enterprise Dairy Manager</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-indigo-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 border border-slate-100">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isLogin ? 'bg-white text-[#1e1b4b] shadow-sm' : 'text-slate-400'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${!isLogin ? 'bg-white text-[#1e1b4b] shadow-sm' : 'text-slate-400'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      required
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Business Name</label>
                  <div className="relative">
                    <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Pure Dairy"
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                {isLogin && (
                  <button type="button" className="text-[10px] font-bold text-indigo-600 uppercase">Forgot?</button>
                )}
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider text-center">{error}</p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e1b4b] text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
              <ArrowRight size={16} strokeWidth={3} />
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or Continue With</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4">
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full py-4 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Google Personal Account
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-slate-500">
           <ShieldCheck size={16} />
           <p className="text-[10px] font-bold uppercase tracking-widest">Secure Cloud Encryption Active</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
