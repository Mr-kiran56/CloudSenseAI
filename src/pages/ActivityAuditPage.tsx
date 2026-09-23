import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { AuditEvent } from '../types';
import { Activity, Download, Search, Filter } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ActivityAuditPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getAuditEvents();
        setEvents(res.data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Timestamp,Actor,Action,Resource,Environment,Result,CorrelationID,Details\n' +
      events
        .map(
          (e) => `${e.timestamp},"${e.actor}",${e.action},${e.resourceId},${e.environment},${e.result},${e.correlationId},"${e.details}"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'CloudSense_Immutable_Audit_Log.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({ type: 'success', title: 'Export Complete', message: 'Audit event log exported as CSV.' });
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const filtered = events.filter(
    (e) =>
      e.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.correlationId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Immutable Audit & Activity Logs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete compliance record of user actions, AI anomaly alerts, approvals, and Boto3 SDK execution jobs
          </p>
        </div>

        <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
          Export Audit Logs
        </Button>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by actor, action, resource ID, or correlation ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-mono border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-3">Timestamp (UTC)</th>
              <th className="p-3">Actor / Agent</th>
              <th className="p-3">Action Event</th>
              <th className="p-3">Target Resource</th>
              <th className="p-3">Env</th>
              <th className="p-3">Result</th>
              <th className="p-3 font-mono">Correlation ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-mono text-slate-400">{e.timestamp}</td>
                <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{e.actor}</td>
                <td className="p-3">
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{e.action}</span>
                </td>
                <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{e.resourceId}</td>
                <td className="p-3 uppercase font-mono text-[10px]">{e.environment}</td>
                <td className="p-3">
                  <Badge variant={e.result === 'success' ? 'success' : e.result === 'warning' ? 'warning' : 'critical'}>
                    {e.result.toUpperCase()}
                  </Badge>
                </td>
                <td className="p-3 font-mono text-[10px] text-slate-400">{e.correlationId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
