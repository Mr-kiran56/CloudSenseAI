import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  PieChart,
  Server,
  Lightbulb,
  ShieldAlert,
  PlayCircle,
  Sliders,
  Activity,
  MessageSquare,
  Bell,
  Workflow,
  CheckSquare,
  Cloud,
  ScrollText,
  Settings,
  HelpCircle,
  PanelLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../context/AppContext';
import { Logo } from '../brand/Logo';

interface NavGroup {
  title: string;
  items: {
    name: string;
    path: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[];
}

export const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    isDemoData,
  } = useApp();
  const location = useLocation();

  const navigation: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }],
    },
    {
      title: 'Intelligence',
      items: [
        { name: 'Cost & forecast', path: '/cost', icon: <TrendingUp className="w-4 h-4" /> },
        { name: 'Unit economics', path: '/unit-economics', icon: <PieChart className="w-4 h-4" /> },
        { name: 'Resources', path: '/resources', icon: <Server className="w-4 h-4" /> },
        { name: 'Recommendations', path: '/recommendations', icon: <Lightbulb className="w-4 h-4" />, badge: 4 },
        { name: 'Anomalies & DoW', path: '/anomalies', icon: <ShieldAlert className="w-4 h-4" />, badge: '2' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Remediation', path: '/remediation', icon: <PlayCircle className="w-4 h-4" /> },
        { name: 'What-if simulator', path: '/simulator', icon: <Sliders className="w-4 h-4" /> },
        { name: 'Activity', path: '/activity', icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Collaboration',
      items: [
        { name: 'Assistant', path: '/assistant', icon: <MessageSquare className="w-4 h-4" /> },
        { name: 'Notifications', path: '/notifications', icon: <Bell className="w-4 h-4" />, badge: 2 },
        { name: 'Integrations', path: '/integrations', icon: <Workflow className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Governance',
      items: [
        { name: 'Approvals', path: '/approvals', icon: <CheckSquare className="w-4 h-4" />, badge: 3 },
        { name: 'Cloud accounts', path: '/cloud-accounts', icon: <Cloud className="w-4 h-4" /> },
        { name: 'Policies', path: '/policies', icon: <ScrollText className="w-4 h-4" /> },
      ],
    },
    {
      title: 'System',
      items: [
        { name: 'Settings', path: '/settings', icon: <Settings className="w-4 h-4" /> },
        { name: 'Help', path: '/help', icon: <HelpCircle className="w-4 h-4" /> },
      ],
    },
  ];

  const aside = (
    <aside
      className={clsx(
        'h-full bg-[var(--cs-surface)] border-r border-[var(--cs-line)] text-[var(--cs-ink-2)] flex flex-col shrink-0 z-30',
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="h-14 flex items-center justify-between px-3 border-b border-[var(--cs-line)] shrink-0">
        <NavLink to="/dashboard" className="min-w-0 overflow-hidden" onClick={() => setMobileNavOpen(false)}>
          <Logo size={28} withWordmark={!sidebarCollapsed} compact />
        </NavLink>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:inline-flex p-1.5 rounded-[4px] text-[var(--cs-ink-3)] hover:bg-[var(--cs-muted)]"
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Primary">
        {navigation.map((group) => (
          <div key={group.title} className="mb-4">
            {!sidebarCollapsed && (
              <p className="px-2.5 mb-1 text-[11px] font-medium text-[var(--cs-ink-3)]">{group.title}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.name : undefined}
                    onClick={() => setMobileNavOpen(false)}
                    className={clsx(
                      'group relative flex items-center gap-3 h-9 px-2.5 rounded-[4px] text-[13px] transition-colors',
                      active
                        ? 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] font-medium'
                        : 'text-[var(--cs-ink-2)] hover:bg-[var(--cs-muted)]'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--cs-brand)]" />
                    )}
                    <span className="shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && <span className="truncate flex-1">{item.name}</span>}
                    {item.badge && !sidebarCollapsed && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--cs-muted)] text-[10px] font-medium text-[var(--cs-ink-2)] text-center leading-[18px] tabular-nums">
                        {item.badge}
                      </span>
                    )}
                    {sidebarCollapsed && (
                      <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[var(--cs-ink)] text-white text-[12px] rounded-[4px] opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
                        {item.name}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!sidebarCollapsed && isDemoData && (
        <div className="m-2 p-2.5 rounded-[4px] bg-[var(--cs-warn-soft)] text-[11px] leading-snug text-[var(--cs-warn)]">
          <p className="font-medium">Demo data</p>
          <p className="mt-0.5 opacity-90">Backend APIs are not connected. Figures are labeled demo, not live AWS billing.</p>
        </div>
      )}
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-full">{aside}</div>
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 cs-shadow-md">{aside}</div>
        </div>
      )}
    </>
  );
};
