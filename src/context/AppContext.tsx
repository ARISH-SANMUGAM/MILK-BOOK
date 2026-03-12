import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, getCustomers, Settings, Customer } from '../services/db';

interface AppContextType {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  loading: boolean;
  refreshCustomers: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({ rate: 60, businessName: 'MilkBook', address: '' });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCustomers = async () => {
    const list = await getCustomers();
    setCustomers(list);
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const s = await getSettings();
        setSettings(s);
        const c = await getCustomers();
        setCustomers(c);
      } catch (err) {
        console.error("Boot error", err);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  return (
    <AppContext.Provider value={{ settings, setSettings, customers, setCustomers, loading, refreshCustomers }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
