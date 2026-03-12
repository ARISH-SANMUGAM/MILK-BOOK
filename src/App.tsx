import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Settings as SettingsIcon, 
  Users, 
  LayoutDashboard,
  ClipboardList
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Delivery from './pages/Delivery';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { id: 'delivery', label: 'Entry', icon: ClipboardList, path: '/' },
    { id: 'customers', label: 'Customers', icon: Users, path: '/customers' },
    { id: 'dashboard', label: 'Stats', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = (tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center space-y-1 transition-all ${
                isActive ? 'text-black' : 'text-gray-900/60 hover:text-black'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-black text-white' : 'bg-transparent text-gray-900'}`}>
                <tab.icon size={19} strokeWidth={isActive ? 3 : 2} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-black' : 'text-gray-900/50'}`}>
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
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen bg-gray-100/30 pb-20 max-w-lg mx-auto shadow-2xl overflow-x-hidden relative scroll-smooth border-x border-gray-200">
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<PageWrapper><Delivery /></PageWrapper>} />
          <Route path="/customers" element={<PageWrapper><Customers /></PageWrapper>} />
          <Route path="/dashboard" element={<PageWrapper><Dashboard /></PageWrapper>} />
          <Route path="/reports" element={<PageWrapper><Reports /></PageWrapper>} />
          <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
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
