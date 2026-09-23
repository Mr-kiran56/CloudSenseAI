import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { mockUserProfile } from '../services/mockData';

const SESSION_KEY = 'cloudsense_session';

interface SessionState {
  authenticated: boolean;
  user: UserProfile;
}

interface AuthContextType {
  user: UserProfile;
  isAuthenticated: boolean;
  isReady: boolean;
  setRole: (role: UserRole) => void;
  hasPermission: (permission: 'approve' | 'remediate' | 'admin' | 'edit_policy') => boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, role?: UserRole) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persist(session: SessionState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ authenticated: session.authenticated, user: session.user }));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile>(mockUserProfile);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionState;
        if (parsed.authenticated && parsed.user) {
          setUser(parsed.user);
          setIsAuthenticated(true);
        }
      }
    } catch {
      /* ignore */
    }
    setIsReady(true);
  }, []);

  const setRole = (role: UserRole) => {
    setUser((prev) => {
      const next = { ...prev, role };
      persist({ authenticated: isAuthenticated, user: next });
      return next;
    });
  };

  const hasPermission = (permission: 'approve' | 'remediate' | 'admin' | 'edit_policy'): boolean => {
    if (user.role === 'admin') return true;
    if (user.role === 'finops_analyst') {
      return permission === 'approve' || permission === 'remediate';
    }
    if (user.role === 'cloud_engineer') {
      return permission === 'remediate';
    }
    return false;
  };

  const login = async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 450));
    if (!email.includes('@')) return { ok: false, error: 'Enter a valid work email.' };
    if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
    const next: UserProfile = {
      ...mockUserProfile,
      email,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    };
    setUser(next);
    setIsAuthenticated(true);
    persist({ authenticated: true, user: next });
    return { ok: true };
  };

  const signup = async (name: string, email: string, password: string, role: UserRole = 'cloud_engineer') => {
    await new Promise((r) => setTimeout(r, 500));
    if (name.trim().length < 2) return { ok: false, error: 'Enter your name.' };
    if (!email.includes('@')) return { ok: false, error: 'Enter a valid work email.' };
    if (password.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
    const next: UserProfile = {
      ...mockUserProfile,
      name: name.trim(),
      email,
      role,
    };
    setUser(next);
    setIsAuthenticated(true);
    persist({ authenticated: true, user: next });
    return { ok: true };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isReady, setRole, hasPermission, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
