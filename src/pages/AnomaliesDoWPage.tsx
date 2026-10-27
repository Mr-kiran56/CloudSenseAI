import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Anomaly } from '../types';
import {
  ShieldAlert,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Database,
  Play,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export const AnomaliesDoWPage: React.FC = () => {
  const { addToast } = useApp();
  const navigate = useNavigate();
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
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--cs-line)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-ink)]">
              Anomalies & Denial-of-Wallet (DoW) Command Center
            </h1>
          </div>
          <p className="text-xs text-[var(--cs-ink-3)] mt-1">
            Real-time financial vulnerability detection, 5-minute request rate spikes, cost velocity alerts & MCP mitigation.
          </p>
        </div>
      </div>

      {/* Denial-of-Wallet (DoW) Alert Workspace */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-[var(--cs-ink)] flex items-center gap-2 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>Active Denial-of-Wallet (DoW) Threat Incidents</span>
        </h2>

        {dowAlerts.map((dow) => (
          <Card key={dow.id} className="border-l-4 border-l-rose-500 cs-shadow p-6">
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="critical">DoW Candidate (Model C)</Badge>
                    <Badge variant="ai">Confidence: {Math.round(dow.confidence * 100)}%</Badge>
                    <span className="text-[11px] font-mono text-[var(--cs-ink-3)]">{dow.detectedAt}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--cs-ink)] mt-1.5">
                    {dow.title}
                  </h3>
                  <p className="text-xs font-mono text-[var(--cs-ink-3)] mt-0.5">
                    Target: {dow.resourceId}
                  </p>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    addToast({
                      type: 'warning',
                      title: 'WAF Rate-Limiting Policy Dispatched',
                      message: 'Submitted automated WAF rule update to MCP remediation queue.',
                    })
                  }
                >
                  Deploy WAF Throttle Mitigation
                </Button>
              </div>

              {/* Empirical Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[var(--cs-muted)]/60 rounded-xl border border-[var(--cs-line)] text-xs font-mono">
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[10px] uppercase font-semibold">COST VELOCITY</span>
                  <span className="text-base font-bold text-rose-500 dark:text-rose-400">{dow.costVelocity}</span>
                  <span className="text-[10px] text-[var(--cs-ink-3)] block">Baseline: +0.02%/15m</span>
                </div>
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[10px] uppercase font-semibold">REQUEST RATE SPIKE</span>
                  <span className="text-base font-bold text-[var(--cs-ink)]">{dow.requestRateChange}</span>
                  <span className="text-[10px] text-[var(--cs-ink-3)] block">Zero order completions</span>
                </div>
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[10px] uppercase font-semibold">CONCURRENCY SATURATION</span>
                  <span className="text-base font-bold text-amber-500 dark:text-amber-400">{dow.provisioningSpike}</span>
                  <span className="text-[10px] text-[var(--cs-ink-3)] block">Near unreserved pool cap</span>
                </div>
              </div>

              {/* Evidence Log List */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[var(--cs-ink)] uppercase tracking-wider text-[11px]">Isolation Forest Evidence Trail:</span>
                <ul className="list-disc pl-5 text-[var(--cs-ink-2)] space-y-1 text-xs">
                  {dow.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>

              {/* Incident Resolution Timeline */}
              <div className="pt-4 border-t border-[var(--cs-line)]">
                <span className="font-semibold text-xs text-[var(--cs-ink)] block mb-3 uppercase tracking-wider">
                  Incident Resolution Timeline
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  {dow.attackTimeline.map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border space-y-1 ${
                        step.status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : step.status === 'current'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold'
                          : 'bg-[var(--cs-surface)] border-[var(--cs-line)] text-[var(--cs-ink-3)]'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold uppercase">{step.step}</div>
                      <div className="text-[10px] font-mono text-[var(--cs-ink-3)]">{step.timestamp}</div>
                      <div className="text-[11px] leading-tight text-[var(--cs-ink-2)] mt-1">{step.description}</div>
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
        <h2 className="text-xs font-bold text-[var(--cs-ink)] flex items-center gap-2 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-amber-500" />
          <span>General Operational Cost Velocity Anomalies</span>
        </h2>

        {costAnomalies.map((anom) => (
          <Card key={anom.id} className="p-5 cs-shadow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Cost Velocity Anomaly</Badge>
                  <span className="font-mono text-[var(--cs-ink-3)]">{anom.detectedAt}</span>
                  <span className="text-[var(--cs-ink-3)]">&bull;</span>
                  <span className="font-mono text-[var(--cs-ink-3)]">{anom.resourceId}</span>
                </div>
                <h3 className="text-base font-bold text-[var(--cs-ink)]">{anom.title}</h3>
                <p className="text-[var(--cs-ink-2)]">
                  Cost Velocity: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{anom.costVelocity}</span> &bull; {anom.provisioningSpike}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/resources')}>
                Inspect Node Telemetry
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
