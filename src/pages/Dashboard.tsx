import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge, RiskBadge, ConfidenceBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import { PageHeader, SegmentedControl } from '../components/ui/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { apiService } from '../services/api';
import { DashboardSummary, CostForecastPoint, CostBreakdownItem, Recommendation, Anomaly } from '../types';
import {
  DollarSign,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  Server,
  ChevronRight,
  CheckSquare,
  Database,
  Cpu,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useApp } from '../context/AppContext';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isDemoData } = useApp();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [forecast, setForecast] = useState<CostForecastPoint[]>([]);
  const [breakdown, setBreakdown] = useState<CostBreakdownItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [timeRange, setTimeRange] = useState('30D');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, fcRes, bdRes, recRes, anomRes] = await Promise.all([
          apiService.getDashboardSummary(),
          apiService.getCostForecast(30),
          apiService.getCostBreakdown(),
          apiService.getRecommendations(),
          apiService.getAnomalies(),
        ]);
        setSummary(sumRes.data);
        setForecast(fcRes.data);
        setBreakdown(bdRes.data);
        setRecommendations(recRes.data);
        setAnomalies(anomRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-6 p-2">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const dowAnomaly = anomalies.find((a) => a.type === 'denial_of_wallet');
  const tooltipStyle = {
    backgroundColor: 'var(--cs-surface)',
    border: '1px solid var(--cs-line)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--cs-ink)',
    boxShadow: 'var(--cs-shadow-md)',
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="FinOps Executive Command"
        description="Continuous cloud cost forecasting, unit economics, denial-of-wallet anomaly triage, and approved remediation."
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl options={['7D', '30D', '90D']} value={timeRange} onChange={setTimeRange} />
            <Button variant="outline" size="sm" onClick={() => navigate('/assistant')}>
              Ask Assistant
            </Button>
          </div>
        }
      />

      {/* Critical DoW Security Alert Card */}
      {dowAnomaly && (
        <div className="border border-rose-500/30 bg-rose-500/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cs-shadow">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Critical Security Anomaly (Model C Isolation Forest)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                  Score: 14.82 &gt; 11.25
                </span>
              </div>
              <p className="text-sm font-semibold text-[var(--cs-ink)] mt-0.5">
                {dowAnomaly.title}
              </p>
              <p className="text-xs text-[var(--cs-ink-2)] mt-1">
                Cost velocity: <strong className="text-rose-600 dark:text-rose-400">{dowAnomaly.costVelocity}</strong> &bull; Concurrency surge without order conversions. Automated WAF rate-limiting rule prepared.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="danger" size="sm" onClick={() => navigate('/anomalies')}>
              Triage & Mitigate
            </Button>
          </div>
        </div>
      )}

      {/* Primary KPI Metrics Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <MetricCard
          label="Current Spend"
          value={`$${(summary?.totalSpend ?? 14280).toLocaleString()}`}
          delta={`${(summary?.spendTrendPercent ?? 4.2) >= 0 ? '+' : ''}${summary?.spendTrendPercent ?? 4.2}% vs prior`}
          deltaTone={(summary?.spendTrendPercent ?? 0) > 0 ? 'bad' : 'good'}
          hint="Production master account"
          icon={<DollarSign className="w-4 h-4 text-blue-400" />}
          spark={[18, 20, 19, 22, 24, 23, 26]}
          onClick={() => navigate('/cost')}
        />
        <MetricCard
          label="Forecasted Spend"
          value={`$${(summary?.forecastSpend ?? 14890).toLocaleString()}`}
          hint="Prophet 30-day projection"
          icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
          onClick={() => navigate('/cost')}
        />
        <MetricCard
          label="Validated Savings"
          value={`$${(summary?.potentialSavings ?? 3240).toLocaleString()}`}
          delta="4 Approved actions"
          deltaTone="good"
          icon={<Lightbulb className="w-4 h-4 text-emerald-400" />}
          onClick={() => navigate('/recommendations')}
        />
        <MetricCard
          label="Active Anomalies"
          value={String(summary?.activeAnomaliesCount ?? 1)}
          hint="1 Critical DoW Candidate"
          icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
          onClick={() => navigate('/anomalies')}
        />
        <MetricCard
          label="Pending Approvals"
          value={String(summary?.pendingApprovalsCount ?? 3)}
          hint="Human-in-the-loop queue"
          icon={<CheckSquare className="w-4 h-4 text-cyan-400" />}
          onClick={() => navigate('/approvals')}
        />
        <MetricCard
          label="Monitored Resources"
          value={String(summary?.healthyResourceCount ?? 38)}
          hint={`${(summary?.underutilizedResourceCount ?? 3) + (summary?.idleResourceCount ?? 1)} underutilized`}
          icon={<Server className="w-4 h-4 text-indigo-400" />}
          onClick={() => navigate('/resources')}
        />
      </div>

      {/* Main Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prophet Forecasting Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Cloud Spend Trajectory versus Prophet Forecast"
            subtitle="Actual daily expenditure, Model A Prophet forward projection, 80% confidence interval, and budget limit."
            action={
              <button
                onClick={() => navigate('/cost')}
                className="text-xs text-[var(--cs-brand)] hover:underline font-medium flex items-center gap-1 transition"
              >
                <span>Full Forecast Workspace</span>
                <ArrowUpRight size={14} />
              </button>
            }
          />
          <div className="h-80 w-full mt-4" role="img" aria-label="Cloud spend actual versus Prophet forecast">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--cs-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }} stroke="var(--cs-line)" />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }}
                  stroke="var(--cs-line)"
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [val ? `$${val}` : '—', '']} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <ReferenceLine
                  y={483.33}
                  label={{ value: 'Daily Budget $483/d', fill: '#10b981', fontSize: 10, position: 'top' }}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="actualCost"
                  name="Actual Historical"
                  stroke="#3b82f6"
                  fill="url(#actualGradient)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="forecastCost"
                  name="Prophet Forecast"
                  stroke="#a855f7"
                  fill="url(#forecastGradient)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="confidenceUpper"
                  name="Confidence Upper (80%)"
                  stroke="#64748b"
                  fill="none"
                  strokeWidth={1}
                />
                <Area
                  type="monotone"
                  dataKey="confidenceLower"
                  name="Confidence Lower (80%)"
                  stroke="#475569"
                  fill="none"
                  strokeWidth={1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Cost Breakdown by Service */}
        <Card>
          <CardHeader title="Service Expenditure Allocation" subtitle="Top cost-generating AWS services" />
          <div className="space-y-4 mt-2">
            {breakdown.map((item, i) => {
              const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
              const itemName = item.name || (item as any).service || `Service ${i + 1}`;
              const itemCost = Number(item.cost ?? 0);
              const itemPct = Number(item.percentage ?? 0);
              const itemChg = Number(item.changePercent ?? 0);
              return (
                <div key={itemName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--cs-ink)] font-medium truncate max-w-[170px]">{itemName}</span>
                    <span className="font-mono font-semibold text-[var(--cs-ink)]">${itemCost.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--cs-muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${itemPct}%`, background: colors[i % colors.length] }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--cs-ink-3)] font-mono">
                    <span>{itemPct}% of total</span>
                    <span className={itemChg > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {itemChg >= 0 ? '+' : ''}{itemChg}% vs prior
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* High-Impact Optimization Opportunities Table */}
      <Card padding={false} className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--cs-line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--cs-ink)]">High-Impact Optimization Opportunities</h2>
            <p className="text-xs text-[var(--cs-ink-3)] mt-0.5">Validated by FinOps Savings Engine and pending human approval</p>
          </div>
          <button
            onClick={() => navigate('/recommendations')}
            className="text-xs text-[var(--cs-brand)] hover:underline font-medium flex items-center gap-1 transition"
          >
            <span>View All ({recommendations.length})</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--cs-muted)] text-[var(--cs-ink-3)] uppercase tracking-wider font-semibold border-b border-[var(--cs-line)]">
              <tr>
                <th className="px-5 py-3">Resource Target</th>
                <th className="px-5 py-3">Problem & Root Cause</th>
                <th className="px-5 py-3">Monthly Savings</th>
                <th className="px-5 py-3">Confidence</th>
                <th className="px-5 py-3">Risk Level</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cs-line)] font-sans">
              {recommendations.slice(0, 4).map((rec) => (
                <tr key={rec.id} className="hover:bg-[var(--cs-muted)]/50 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[var(--cs-ink)]">{rec.resourceName}</p>
                    <p className="font-mono text-[11px] text-[var(--cs-ink-3)]">
                      {rec.resourceId} &bull; {rec.service}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 max-w-sm">
                    <p className="text-[var(--cs-ink-2)] truncate">{rec.problem}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    +${rec.monthlySavings} / mo
                  </td>
                  <td className="px-5 py-3.5">
                    <ConfidenceBadge confidence={rec.aiConfidence} />
                  </td>
                  <td className="px-5 py-3.5">
                    <RiskBadge risk={rec.risk} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={rec.status === 'approved' ? 'success' : 'warning'}>
                      {rec.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/recommendations/${rec.id}`)}>
                      Review & Approve
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
