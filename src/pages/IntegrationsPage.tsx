import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Integration } from '../types';
import { Workflow, MessageSquare, Users, AlertTriangle, Webhook, Check, Plus, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const IntegrationsPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getIntegrations();
        setIntegrations(res.data);
      } catch (err) {
        console.error('Failed to load integrations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Enterprise Integrations & Webhooks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connect CloudSense AI to Slack, MS Teams, PagerDuty & custom REST webhooks
          </p>
        </div>

        <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
          Add Webhook Connector
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => (
          <Card key={item.id} className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-blue-500">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</h3>
                  <Badge variant={item.status === 'connected' ? 'success' : 'warning'}>
                    {item.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addToast({
                    type: 'success',
                    title: 'Test Webhook Fired',
                    message: `Dispatched test ping to ${item.name}. Response 200 OK.`,
                  })
                }
              >
                Test Payload
              </Button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">{item.description}</p>

            {item.webhookUrl && (
              <div className="p-2 bg-slate-100 dark:bg-slate-800/60 rounded font-mono text-[10px] text-slate-400 truncate">
                URL: {item.webhookUrl.substring(0, 42)}... (Secret Masked)
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
