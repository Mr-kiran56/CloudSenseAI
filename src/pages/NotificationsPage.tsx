import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Notification } from '../types';
import { Bell, ShieldAlert, CheckSquare, Sparkles, TrendingUp, Check, Archive, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/ui/PageHeader';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast, selectedAccount } = useApp();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getNotifications(selectedAccount?.accountId);
        setNotifications(res.data);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedAccount?.accountId]);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await apiService.markAllNotificationsRead();
    addToast({ type: 'success', title: 'Notifications Updated', message: 'All notifications marked as read in database.' });
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      await apiService.markNotificationRead(n.id);
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'CRITICAL') return n.severity === 'critical';
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Alerts for cost anomalies, DoW signals, approvals, and system events."
        actions={
          <Button variant="outline" size="sm" icon={<Check className="w-3.5 h-3.5" />} onClick={markAllRead}>
            Mark all read
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-[var(--cs-line)]">
          <Bell className="w-10 h-10 text-[var(--cs-ink-3)] mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-medium text-[var(--cs-ink)]">No Notifications</h3>
          <p className="text-xs text-[var(--cs-ink-3)] max-w-md mx-auto mt-1">
            No active anomalies, warnings, or unread events for {selectedAccount?.name || 'this account'}.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <Card key={n.id} className={n.read ? 'opacity-80' : undefined}>
            <div className="flex items-start justify-between gap-4 text-[13px]">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-[4px] bg-[var(--cs-muted)] mt-0.5">
                  {n.type === 'dow' ? (
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                  ) : n.type === 'approval' ? (
                    <CheckSquare className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Bell className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={n.severity === 'critical' ? 'critical' : n.severity === 'high' ? 'warning' : 'info'}>
                      {n.severity.toUpperCase()}
                    </Badge>
                    <span className="text-[11px] text-[var(--cs-ink-3)] font-mono">{n.timestamp}</span>
                  </div>
                  <h3 className="text-[14px] font-medium text-[var(--cs-ink)] mt-1">{n.title}</h3>
                  <p className="text-[13px] text-[var(--cs-ink-3)] mt-0.5">{n.description}</p>
                </div>
              </div>

              {n.link && (
                <Button variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => handleNotificationClick(n)}>
                  View Event
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
};
