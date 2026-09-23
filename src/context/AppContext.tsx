import React, { createContext, useContext, useEffect, useState } from 'react';
import { AWSAccount } from '../types';
import { mockAWSAccounts } from '../services/mockData';

export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface AppContextType {
  selectedAccount: AWSAccount;
  setSelectedAccount: (acc: AWSAccount) => void;
  accounts: AWSAccount[];
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  dateRange: string;
  setDateRange: (range: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  isDemoData: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts] = useState<AWSAccount[]>(mockAWSAccounts);
  const [selectedAccount, setSelectedAccount] = useState<AWSAccount>(mockAWSAccounts[0]);
  const [selectedRegion, setSelectedRegion] = useState<string>('ap-south-1');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('cs_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(
    () => localStorage.getItem('cs_sidebar') === '1'
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isDemoData = true;

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem('cs_sidebar', collapsed ? '1' : '0');
  };

  const setTheme = (next: 'dark' | 'light') => {
    setThemeState(next);
    localStorage.setItem('cs_theme', next);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        selectedAccount,
        setSelectedAccount,
        accounts,
        selectedRegion,
        setSelectedRegion,
        dateRange,
        setDateRange,
        theme,
        toggleTheme,
        setTheme,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        shortcutsOpen,
        setShortcutsOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileNavOpen,
        setMobileNavOpen,
        toasts,
        addToast,
        removeToast,
        isDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
