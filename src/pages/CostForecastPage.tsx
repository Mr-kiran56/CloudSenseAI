import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { CostForecastPoint, CostBreakdownItem } from '../types';
import {
  TrendingUp,
  Download,
  Filter,
  Sparkles,
  DollarSign,
  AlertCircle,
  BarChart2,
  Calendar,
  Layers,
  ArrowUpRight,
  Database,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { PageHeader, SegmentedControl } from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export const CostForecastPage: React.FC = () => {
  const { addToast } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<CostForecastPoint[]>([]);
  const [breakdown, setBreakdown] = useState<CostBreakdownItem[]>([]);
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [horizonLabel, setHorizonLabel] = useState<string>('30D Horizon');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fcRes, bdRes] = await Promise.all([
          apiService.getCostForecast(horizonDays),
          apiService.getCostBreakdown(),
        ]);
        setForecast(fcRes.data);
        setBreakdown(bdRes.data);
      } catch (err) {
        console.error('Failed to load cost forecast:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [horizonDays]);

  const handleHorizonChange = (val: string) => {
    setHorizonLabel(val);
    if (val === '7D Horizon') setHorizonDays(7);
    else if (val === '30D Horizon') setHorizonDays(30);
    else if (val === '90D Horizon') setHorizonDays(90);
  };

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Date,ActualCost,ForecastCost,ConfidenceLower,ConfidenceUpper,BudgetLimit\n' +
      forecast
        .map(
          (f) => `${f.date},${f.actualCost || ''},${f.forecastCost},${f.confidenceLower},${f.confidenceUpper},${f.budgetLimit}`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CloudSense_Prophet_${horizonDays}d_Forecast.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Export Complete',
      message: `Prophet ${horizonDays}-day cost forecast dataset exported as CSV.`,
    });
  };

  if (loading && forecast.length === 0) return <Skeleton className="h-96 w-full" />;

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
        title="Cloud Cost Forecasting & Budget Trajectory"
        description="Daily actual spend, forward-looking Prophet model projection, 80% confidence interval bands, and budget-overrun detection."
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={['7D Horizon', '30D Horizon', '90D Horizon']}
              value={horizonLabel}
              onChange={handleHorizonChange}
            />
            <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider">Current Monthly Burn</p>
          <p className="mt-2 text-2xl font-bold font-mono text-[var(--cs-ink)]">$14,280.00</p>
          <p className="mt-1 text-xs text-[var(--cs-ink-3)] font-mono">Run rate: $476.00 / day</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider">Prophet Projected Month-End</p>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-500 dark:text-amber-400">$14,840.50</p>
          <p className="mt-1 text-xs text-rose-500 dark:text-rose-400 font-mono">+$340.50 (+2.3%) above budget</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider">Hold-out Error (MAPE)</p>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">4.8%</p>
          <p className="mt-1 text-xs text-[var(--cs-ink-3)] font-mono">Outperforms ARIMA baseline (17.2%)</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider">Identified Savings</p>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">+$3,240.00 / mo</p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-mono">Lowers projected burn by 22.7%</p>
        </Card>
      </div>

      {/* Main Prophet Forecast Visualization */}
      <Card>
        <CardHeader
          title={`Prophet Expenditure Forecast (${horizonDays}-Day Horizon)`}
          subtitle="Trained Prophet model decomposition with rolling-origin cross validation, confidence envelopes, and daily threshold."
        />

        <div className="h-96 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecast} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="areaActualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="areaUpperGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--cs-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }} stroke="var(--cs-line)" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }} stroke="var(--cs-line)" tickFormatter={(val) => `$${val}`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <ReferenceLine y={483.33} label={{ value: 'Daily Budget $483/d', fill: '#10b981', fontSize: 11, position: 'top' }} stroke="#10b981" strokeDasharray="4 4" />
              
              <Area type="monotone" dataKey="confidenceUpper" name="Upper 80% Bound" stroke="none" fill="url(#areaUpperGrad)" />
              <Area type="monotone" dataKey="confidenceLower" name="Lower 80% Bound" stroke="none" fill="var(--cs-surface)" />
              
              <Line type="monotone" dataKey="actualCost" name="Actual Spend" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="forecastCost" name="Prophet Forecast" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Root Cause Explainability & Attribution */}
      <Card>
        <CardHeader
          title="Why is spend changing? (XAI Root Cause Analysis)"
          subtitle="Feature attribution explaining key factors behind recent and forward-looking cost variance"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-[var(--cs-line)] bg-[var(--cs-muted)]/50">
            <p className="text-xs font-bold text-rose-500 dark:text-rose-400">EC2 Analytics Provisioning (+18.5%)</p>
            <p className="text-xs text-[var(--cs-ink-2)] mt-2 leading-relaxed">
              Oversized <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">c5.4xlarge</code> nodes running ETL batch workloads with average CPU utilization under 15%.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[var(--cs-line)] bg-[var(--cs-muted)]/50">
            <p className="text-xs font-bold text-rose-500 dark:text-rose-400">EBS gp3 Surcharge (+12.1%)</p>
            <p className="text-xs text-[var(--cs-ink-2)] mt-2 leading-relaxed">
              6 unattached storage volumes totaling 2,400 GB orphaned post-Kubernetes node retirement ($394/mo).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[var(--cs-line)] bg-[var(--cs-muted)]/50">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">RDS Aurora Rightsizing (−6.4%)</p>
            <p className="text-xs text-[var(--cs-ink-2)] mt-2 leading-relaxed">
              Read-replica resized from <code className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">db.r5.xlarge</code> to Graviton <code className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">db.r6g.large</code>, saving $420/month.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[var(--cs-line)] bg-[var(--cs-muted)]/50">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">NAT Gateway Cross-AZ Egress</p>
            <p className="text-xs text-[var(--cs-ink-2)] mt-2 leading-relaxed">
              12.4 TB S3 backup transfer routing over a public NAT gateway due to missing VPC S3 gateway endpoint.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
