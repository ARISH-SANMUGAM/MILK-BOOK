import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, getCustomers, Settings, Customer } from '../services/db';
import { auth } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AppContextType {
  user: User | null;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  loading: boolean;
  refreshCustomers: () => Promise<void>;
  showTour: boolean;
  setShowTour: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>({ rate: 0, businessName: '', address: '' });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  const refreshCustomers = async () => {
    if (!user) return;
    const list = await getCustomers();
    setCustomers(list);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const s = await getSettings();
          setSettings(s);
          const c = await getCustomers();
          setCustomers(c);
          
          // Check if it's a new user for tour
          const hasSeenTour = localStorage.getItem(`tour_seen_${u.uid}`);
          if (!hasSeenTour) {
             setShowTour(true);
          }
        } catch (err) {
          console.error("Boot error", err);
        }
      } else {
        setCustomers([]);
        setSettings({ rate: 0, businessName: '', address: '' });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <AppContext.Provider value={{ 
      user, 
      settings, 
      setSettings, 
      customers, 
      setCustomers, 
      loading, 
      refreshCustomers,
      showTour,
      setShowTour
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
