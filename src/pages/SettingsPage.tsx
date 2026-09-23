import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader, SegmentedControl } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { User, Shield, Bell, Cpu, Key, Sun, Workflow, Cloud } from 'lucide-react';

const sections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ai', label: 'AI & forecasting', icon: Cpu },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'access', label: 'Access control', icon: Key },
  { id: 'integrations', label: 'Integrations', icon: Workflow },
  { id: 'accounts', label: 'Cloud accounts', icon: Cloud },
];

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme, addToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [density, setDensity] = useState<'Comfortable' | 'Compact'>('Comfortable');

  const pathSection = location.pathname.split('/')[2];
  const active = sections.some((s) => s.id === pathSection) ? pathSection : 'profile';

  const visible = useMemo(
    () => sections.filter((s) => s.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Profile, appearance, notification routing, model thresholds, and access. Preferences persist through the API layer when connected."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        <Card className="p-2 h-fit">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            className="w-full h-8 mb-2 px-2.5 text-[13px] rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-bg)]"
          />
          {visible.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/settings/${s.id}`)}
              className={`w-full text-left px-2.5 h-9 text-[13px] rounded-[4px] flex items-center gap-2 ${
                active === s.id
                  ? 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] font-medium'
                  : 'text-[var(--cs-ink-2)] hover:bg-[var(--cs-muted)]'
              }`}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </Card>

        <div className="space-y-4">
          {active === 'profile' && (
            <Card>
              <CardHeader title="Profile" subtitle="Shown in audit events and approvals" />
              <dl className="grid sm:grid-cols-2 gap-4 text-[13px]">
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Name</dt>
                  <dd className="mt-0.5 font-medium">{user.name}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Email</dt>
                  <dd className="mt-0.5 font-medium">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Role</dt>
                  <dd className="mt-0.5 font-medium capitalize">{user.role.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Title</dt>
                  <dd className="mt-0.5 font-medium">{user.title}</dd>
                </div>
              </dl>
            </Card>
          )}

          {(active === 'appearance' || active === 'profile') && (
            <Card>
              <CardHeader title="Appearance" />
              <div className="space-y-4 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-[12px] text-[var(--cs-ink-3)]">Light is the default console surface.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant={theme === 'light' ? 'primary' : 'outline'} size="sm" onClick={() => setTheme('light')}>
                      Light
                    </Button>
                    <Button variant={theme === 'dark' ? 'primary' : 'outline'} size="sm" onClick={() => setTheme('dark')}>
                      Dark
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--cs-line)] pt-4">
                  <div>
                    <p className="font-medium">Density</p>
                    <p className="text-[12px] text-[var(--cs-ink-3)]">Compact tightens tables for operations work.</p>
                  </div>
                  <SegmentedControl
                    options={['Comfortable', 'Compact']}
                    value={density}
                    onChange={(v) => setDensity(v as 'Comfortable' | 'Compact')}
                  />
                </div>
              </div>
            </Card>
          )}

          {active === 'ai' && (
            <Card>
              <CardHeader
                title="Forecasting and detection"
                subtitle="Thresholds are requested to the backend. They do not change AWS by themselves."
              />
              <label className="block text-[13px]">
                Isolation Forest sensitivity
                <input type="range" min={0.5} max={0.99} step={0.01} defaultValue={0.85} className="w-full mt-2 accent-[var(--cs-brand)]" />
                <span className="text-[12px] text-[var(--cs-ink-3)]">Higher values reduce false positives.</span>
              </label>
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() =>
                    addToast({
                      type: 'success',
                      title: 'Preferences saved',
                      message: 'AI thresholds stored in demo session. Backend must persist in production.',
                    })
                  }
                >
                  Save
                </Button>
              </div>
            </Card>
          )}

          {active === 'security' && (
            <Card>
              <CardHeader title="Security" />
              <p className="text-[13px] leading-6 text-[var(--cs-ink-2)]">
                AWS access keys, webhook secrets, and session tokens are never stored in localStorage. Account IDs are
                masked in the console. State-changing actions require confirmation and backend authorization.
              </p>
            </Card>
          )}

          {active === 'notifications' && (
            <Card>
              <CardHeader title="Notification channels" />
              <p className="text-[13px] text-[var(--cs-ink-2)]">
                Route cost, DoW, approval, and remediation events in the Integrations workspace. Email is the default
                for this demo.
              </p>
            </Card>
          )}

          {['access', 'integrations', 'accounts'].includes(active) && (
            <Card>
              <CardHeader title={sections.find((s) => s.id === active)?.label || ''} />
              <p className="text-[13px] text-[var(--cs-ink-2)]">
                Managed in the matching console area. This settings search exists so operators can find the control
                without hunting the sidebar.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(active === 'accounts' ? '/cloud-accounts' : active === 'integrations' ? '/integrations' : '/approvals')
                }
              >
                Open related workspace
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
