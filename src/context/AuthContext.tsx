import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { mockUserProfile } from '../services/mockData';
import { apiService } from '../services/api';

const SESSION_KEY = 'cloudsense_session';
const TOKEN_KEY = 'cloudsense_jwt_token';

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
  signup: (name: string, email: string, password: string, role?: UserRole, awsData?: any) => Promise<{ ok: boolean; error?: string }>;
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
    async function loadSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        const token = localStorage.getItem(TOKEN_KEY);
        
        if (raw) {
          const parsed = JSON.parse(raw) as SessionState;
          if (parsed.authenticated && parsed.user) {
            setUser(parsed.user);
            setIsAuthenticated(true);
          }
        } else if (token) {
          // Attempt to fetch fresh profile from backend
          const res = await apiService.getUserProfile();
          if (res && res.data) {
            setUser(res.data);
            setIsAuthenticated(true);
            persist({ authenticated: true, user: res.data });
          }
        }
      } catch {
        /* ignore */
      } finally {
        setIsReady(true);
      }
    }

    loadSession();
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

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    if (!email.includes('@')) return { ok: false, error: 'Enter a valid work email.' };
    if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };

    // 1. Authenticate against database API
    const backendRes = await apiService.login(email.toLowerCase().trim(), password);
    if (backendRes.success && backendRes.user) {
      const u = backendRes.user;
      const nextUser: UserProfile = {
        ...mockUserProfile,
        id: String(u.id),
        email: u.email,
        name: u.name,
        role: (u.role as UserRole) || 'admin',
      };
      setUser(nextUser);
      setIsAuthenticated(true);
      persist({ authenticated: true, user: nextUser });
      return { ok: true };
    }

    // 2. Strict error rejection: do NOT bypass with email.includes('@')
    return {
      ok: false,
      error: backendRes.error || 'Invalid credentials. Please verify your email and password.',
    };
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    role: UserRole = 'cloud_engineer',
    awsData?: any
  ): Promise<{ ok: boolean; error?: string }> => {
    if (name.trim().length < 2) return { ok: false, error: 'Enter your name.' };
    if (!email.includes('@')) return { ok: false, error: 'Enter a valid work email.' };
    if (password.length < 6) return { ok: false, error: 'Use at least 6 characters for the password.' };

    const backendRes = await apiService.register(name, email.toLowerCase().trim(), password, role, awsData);
    if (backendRes.success && backendRes.user) {
      const u = backendRes.user;
      const nextUser: UserProfile = {
        ...mockUserProfile,
        id: String(u.id),
        email: u.email,
        name: u.name,
        role: (u.role as UserRole) || role,
      };
      setUser(nextUser);
      setIsAuthenticated(true);
      persist({ authenticated: true, user: nextUser });
      return { ok: true };
    }

    // Return the actual database validation error (e.g. Email is already registered)
    return {
      ok: false,
      error: backendRes.error || 'Registration failed. This email may already have an account.',
    };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
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
