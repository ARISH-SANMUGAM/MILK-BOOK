import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Settings as SettingsIcon, 
  Users, 
  Home,
  FileText
} from 'lucide-react';

import Customers from './pages/Customers';
import Delivery from './pages/Delivery';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Bills from './pages/Bills';
import Login from './pages/Login';
import AppTour from './components/AppTour';
import { useAppContext } from './context/AppContext';

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { id: 'delivery', label: 'Home', icon: Home, path: '/' },
    { id: 'customers', label: 'Customers', icon: Users, path: '/customers' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'bills', label: 'Bills', icon: FileText, path: '/bills' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-indigo-100 pb-safe z-50 shadow-[0_-10px_40px_rgba(20,20,50,0.08)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#1e1b4b]/20 to-transparent" />
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = (tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 ${
                isActive ? 'text-[#1e1b4b]' : 'text-slate-400 hover:text-indigo-600'
              }`}
            >
              <tab.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {tab.label}
              </span>

            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const { user, loading } = useAppContext();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F4FF] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#F1F4FF] pb-24 max-w-lg mx-auto shadow-2xl overflow-x-hidden relative scroll-smooth">
      <AppTour />
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<PageWrapper><Delivery /></PageWrapper>} />
          <Route path="/customers" element={<PageWrapper><Customers /></PageWrapper>} />
          <Route path="/reports" element={<PageWrapper><Reports /></PageWrapper>} />
          <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
          <Route path="/bills" element={<PageWrapper><Bills /></PageWrapper>} />
        </Routes>
      </AnimatePresence>
      <Navigation />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
