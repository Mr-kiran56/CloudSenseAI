import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Cloud,
  Globe,
  Bell,
  Sun,
  Moon,
  Shield,
  Check,
  ChevronDown,
  Activity,
  LogOut,
  User,
  Settings,
  Menu,
  Keyboard,
  HelpCircle,
} from 'lucide-react';
import { UserRole } from '../../types';
import { Kbd } from '../ui/PageHeader';

export const Topbar: React.FC = () => {
  const {
    selectedAccount,
    setSelectedAccount,
    accounts,
    selectedRegion,
    setSelectedRegion,
    theme,
    toggleTheme,
    setCommandPaletteOpen,
    setMobileNavOpen,
    setShortcutsOpen,
  } = useApp();

  const { user, setRole, logout } = useAuth();
  const navigate = useNavigate();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const regions = [
    { id: 'ap-south-1', label: 'Mumbai', code: 'ap-south-1' },
    { id: 'us-east-1', label: 'N. Virginia', code: 'us-east-1' },
    { id: 'eu-west-1', label: 'Ireland', code: 'eu-west-1' },
  ];

  const roles: { id: UserRole; label: string }[] = [
    { id: 'admin', label: 'Administrator' },
    { id: 'finops_analyst', label: 'FinOps analyst' },
    { id: 'cloud_engineer', label: 'Cloud engineer' },
    { id: 'viewer', label: 'Viewer' },
  ];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
        setIsRegionOpen(false);
        setIsRoleOpen(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const menuCls =
    'absolute right-0 mt-1 min-w-[220px] bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg cs-shadow-md py-1 z-50';

  return (
    <header
      ref={rootRef}
      className="h-14 bg-[var(--cs-surface)] border-b border-[var(--cs-line)] px-3 sm:px-4 flex items-center justify-between shrink-0 z-20 gap-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          className="lg:hidden p-2 rounded-[4px] text-[var(--cs-ink-2)] hover:bg-[var(--cs-muted)]"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 h-9 px-3 bg-[var(--cs-muted)] hover:bg-[var(--cs-line)] rounded-[4px] text-[var(--cs-ink-3)] text-[13px] w-[min(100%,280px)] sm:w-72"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">Search this workspace</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[13px]">
        <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] bg-[var(--cs-ok-soft)] text-[var(--cs-ok)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--cs-ok)]" />
          <span className="text-[12px] font-medium">Systems healthy</span>
        </div>

        <div className="relative hidden sm:block">
          <button
            onClick={() => {
              setIsAccountOpen(!isAccountOpen);
              setIsRegionOpen(false);
              setIsRoleOpen(false);
              setIsProfileOpen(false);
            }}
            className="flex items-center gap-1.5 h-8 px-2 rounded-[4px] hover:bg-[var(--cs-muted)] text-[var(--cs-ink-2)]"
          >
            <Cloud className="w-3.5 h-3.5 text-[var(--cs-brand)]" />
            <span className="truncate max-w-[120px]">{selectedAccount.alias}</span>
            <ChevronDown className="w-3 h-3 text-[var(--cs-ink-3)]" />
          </button>
          {isAccountOpen && (
            <div className={menuCls}>
              <p className="px-3 py-1.5 text-[11px] text-[var(--cs-ink-3)]">AWS account</p>
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccount(acc);
                    setIsAccountOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--cs-muted)] text-[13px]"
                >
                  <span>
                    <span className="block text-[var(--cs-ink)]">{acc.name}</span>
                    <span className="block text-[11px] font-mono text-[var(--cs-ink-3)]">{acc.accountId}</span>
                  </span>
                  {acc.id === selectedAccount.id && <Check className="w-3.5 h-3.5 text-[var(--cs-brand)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative hidden md:block">
          <button
            onClick={() => {
              setIsRegionOpen(!isRegionOpen);
              setIsAccountOpen(false);
              setIsRoleOpen(false);
              setIsProfileOpen(false);
            }}
            className="flex items-center gap-1.5 h-8 px-2 rounded-[4px] hover:bg-[var(--cs-muted)] text-[var(--cs-ink-2)] font-mono text-[12px]"
          >
            <Globe className="w-3.5 h-3.5 text-[var(--cs-ink-3)]" />
            {selectedRegion}
            <ChevronDown className="w-3 h-3 text-[var(--cs-ink-3)]" />
          </button>
          {isRegionOpen && (
            <div className={menuCls}>
              {regions.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => {
                    setSelectedRegion(reg.id);
                    setIsRegionOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--cs-muted)] text-[13px]"
                >
                  <span>
                    {reg.label}{' '}
                    <span className="font-mono text-[var(--cs-ink-3)]">{reg.code}</span>
                  </span>
                  {reg.id === selectedRegion && <Check className="w-3.5 h-3.5 text-[var(--cs-brand)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative hidden xl:block">
          <button
            onClick={() => {
              setIsRoleOpen(!isRoleOpen);
              setIsAccountOpen(false);
              setIsRegionOpen(false);
              setIsProfileOpen(false);
            }}
            className="flex items-center gap-1.5 h-8 px-2 rounded-[4px] hover:bg-[var(--cs-muted)] text-[var(--cs-ink-2)]"
            title="Role hiding is UI-only. The backend must enforce authorization."
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="capitalize">{user.role.replace('_', ' ')}</span>
            <ChevronDown className="w-3 h-3 text-[var(--cs-ink-3)]" />
          </button>
          {isRoleOpen && (
            <div className={menuCls}>
              <p className="px-3 py-1.5 text-[11px] text-[var(--cs-ink-3)]">Simulate role (frontend only)</p>
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRole(r.id);
                    setIsRoleOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--cs-muted)] text-[13px]"
                >
                  {r.label}
                  {r.id === user.role && <Check className="w-3.5 h-3.5 text-[var(--cs-brand)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-[4px] text-[var(--cs-ink-3)] hover:bg-[var(--cs-muted)]"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <Link
          to="/notifications"
          className="relative p-2 rounded-[4px] text-[var(--cs-ink-3)] hover:bg-[var(--cs-muted)]"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--cs-crit)]" />
        </Link>

        <div className="relative pl-1">
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsAccountOpen(false);
              setIsRegionOpen(false);
              setIsRoleOpen(false);
            }}
            className="flex items-center rounded-full"
            aria-label="Account menu"
          >
            <img
              src={user.avatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-[var(--cs-line)]"
            />
          </button>
          {isProfileOpen && (
            <div className={menuCls + ' w-64'}>
              <div className="px-3 py-2.5 border-b border-[var(--cs-line)]">
                <p className="font-medium text-[var(--cs-ink)]">{user.name}</p>
                <p className="text-[12px] text-[var(--cs-ink-3)] truncate">{user.email}</p>
              </div>
              <Link to="/settings/profile" className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--cs-muted)] text-[13px]">
                <User className="w-3.5 h-3.5" /> Profile
              </Link>
              <Link to="/settings" className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--cs-muted)] text-[13px]">
                <Settings className="w-3.5 h-3.5" /> Preferences
              </Link>
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setShortcutsOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--cs-muted)] text-[13px] text-left"
              >
                <Keyboard className="w-3.5 h-3.5" /> Keyboard shortcuts
              </button>
              <Link to="/help" className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--cs-muted)] text-[13px]">
                <HelpCircle className="w-3.5 h-3.5" /> Help
              </Link>
              <Link to="/activity" className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--cs-muted)] text-[13px]">
                <Activity className="w-3.5 h-3.5" /> Audit activity
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--cs-muted)] text-[13px] text-left text-[var(--cs-crit)] border-t border-[var(--cs-line)]"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
