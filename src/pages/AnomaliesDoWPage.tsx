import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Anomaly } from '../types';
import { ShieldAlert, Zap, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, Activity, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AnomaliesDoWPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getAnomalies();
        setAnomalies(res.data);
      } catch (err) {
        console.error('Failed to load anomalies:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  const dowAlerts = anomalies.filter((a) => a.type === 'denial_of_wallet');
  const costAnomalies = anomalies.filter((a) => a.type === 'cost_anomaly');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
              Anomalies & Denial-of-Wallet (DoW) Command Center
            </h1>
            <Badge variant="critical" icon>Isolation Forest Anomaly Model</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time financial vulnerability detection, request rate spikes, cost velocity alerts & mitigation timelines
          </p>
        </div>
      </div>

      {/* Denial-of-Wallet (DoW) Alert Workspace */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>Denial-of-Wallet (DoW) Threat Detections</span>
        </h2>

        {dowAlerts.map((dow) => (
          <Card key={dow.id} className="border-l-4 border-l-rose-600 dark:border-l-rose-500">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="critical" icon>DoW Threat Flagged</Badge>
                    <Badge variant="ai">Confidence: {Math.round(dow.confidence * 100)}%</Badge>
                    <span className="text-[11px] font-mono text-slate-400">{dow.detectedAt}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {dow.title}
                  </h3>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    addToast({
                      type: 'warning',
                      title: 'WAF Rate-Limiting Policy Dispatched',
                      message: 'Submitted automated WAF rule update to backend execution queue.',
                    })
                  }
                >
                  Apply WAF Throttle Mitigation
                </Button>
              </div>

              {/* Empirical Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">COST VELOCITY</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{dow.costVelocity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">REQUEST RATE SPIKE</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{dow.requestRateChange}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">CONCURRENCY SATURATION</span>
                  <span className="font-mono font-bold text-amber-500">{dow.provisioningSpike}</span>
                </div>
              </div>

              {/* Evidence Log List */}
              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">Isolation Forest Evidence Trail:</span>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300 space-y-1 text-[11px]">
                  {dow.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>

              {/* Incident Resolution Timeline */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block mb-3">
                  Incident Resolution Timeline
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                  {dow.attackTimeline.map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-center space-y-1 ${
                        step.status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : step.status === 'current'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-semibold uppercase">{step.step}</div>
                      <div className="text-[9px] font-mono">{step.timestamp}</div>
                      <div className="text-[10px] leading-tight">{step.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* General Cost Anomalies Workspace */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-amber-500" />
          <span>General Cost Velocity Anomalies</span>
        </h2>

        {costAnomalies.map((anom) => (
          <Card key={anom.id}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Cost Velocity Anomaly</Badge>
                  <span className="font-mono text-slate-400">{anom.detectedAt}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{anom.title}</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Cost Velocity: <span className="font-mono font-bold text-amber-500">{anom.costVelocity}</span> • {anom.provisioningSpike}
                </p>
              </div>
              <Button variant="outline" size="sm">Inspect Node Metrics</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
