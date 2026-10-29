import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AWSAccount } from '../types';
import { mockAWSAccounts } from '../services/mockData';
import { apiService } from '../services/api';

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
  refreshAccounts: () => Promise<void>;
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
  const [accounts, setAccounts] = useState<AWSAccount[]>(mockAWSAccounts);
  const [selectedAccount, setSelectedAccountState] = useState<AWSAccount>(() => {
    const savedId = localStorage.getItem('cs_selected_account_id');
    if (savedId) {
      const found = mockAWSAccounts.find((a) => a.accountId === savedId || a.id === savedId);
      if (found) return found;
    }
    const nonDemo = mockAWSAccounts.find((a) => !a.isDemo && a.accountId !== 'synthesis-demo');
    return nonDemo || mockAWSAccounts[0];
  });

  const setSelectedAccount = (acc: AWSAccount) => {
    setSelectedAccountState(acc);
    if (acc?.accountId) {
      localStorage.setItem('cs_selected_account_id', acc.accountId);
    }
  };

  const selectedRegion = 'us-east-1';
  const setSelectedRegion = (_region: string) => {};
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
  
  // Real-time calculation: only true if viewing synthesis demo lab
  const isDemoData = Boolean(selectedAccount?.isDemo || selectedAccount?.accountId === 'synthesis-demo');

  const refreshAccounts = useCallback(async () => {
    try {
      let userEmail: string | undefined = undefined;
      try {
        const raw = localStorage.getItem('cloudsense_session');
        if (raw) userEmail = JSON.parse(raw)?.user?.email;
      } catch {}

      const res = await apiService.getAWSAccounts(userEmail);
      if (res && res.data && res.data.length > 0) {
        setAccounts(res.data);
        const savedId = localStorage.getItem('cs_selected_account_id');
        const realAcc = res.data.find((a) => !a.isDemo && a.accountId !== 'synthesis-demo');

        setSelectedAccountState((prev) => {
          // If user explicitly saved an account choice that exists, honor it
          if (savedId) {
            const savedMatch = res.data.find((a) => a.accountId === savedId || a.id === savedId);
            if (savedMatch) return savedMatch;
          }

          // If current selection is an authentic real account, retain it
          if (prev && !prev.isDemo && prev.accountId !== 'synthesis-demo') {
            const match = res.data.find((a) => a.id === prev.id || a.accountId === prev.accountId);
            if (match) return match;
          }

          // Default immediately to the real connected AWS account!
          if (realAcc) {
            localStorage.setItem('cs_selected_account_id', realAcc.accountId);
            return realAcc;
          }

          return res.data[0];
        });
      }
    } catch (e) {
      console.warn('Could not refresh cloud accounts:', e);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

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
        refreshAccounts,
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
