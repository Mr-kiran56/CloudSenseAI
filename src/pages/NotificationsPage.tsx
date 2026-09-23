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

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getNotifications();
        setNotifications(res.data);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({ type: 'success', title: 'Notifications Updated', message: 'All notifications marked as read.' });
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'CRITICAL') return n.severity === 'critical';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Notification Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time alerts for cost anomalies, DoW threat detections, approval queues, and system events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Check className="w-3.5 h-3.5" />} onClick={markAllRead}>
            Mark All as Read
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((n) => (
          <Card key={n.id} className={n.read ? 'opacity-80' : 'border-l-4 border-l-blue-600'}>
            <div className="flex items-start justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 mt-0.5">
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
                    <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{n.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">{n.description}</p>
                </div>
              </div>

              {n.link && (
                <Button variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => navigate(n.link!)}>
                  View Event
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
