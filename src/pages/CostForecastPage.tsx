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

export const CostForecastPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<CostForecastPoint[]>([]);
  const [breakdown, setBreakdown] = useState<CostBreakdownItem[]>([]);
  const [granularity, setGranularity] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual'>('Daily');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fcRes, bdRes] = await Promise.all([
          apiService.getCostForecast(),
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
  }, []);

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
    link.setAttribute('download', 'CloudSense_Prophet_Cost_Forecast.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Export Complete',
      message: 'Prophet Cost Forecast dataset exported as CSV.',
    });
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost & forecast"
        description="Actual spend, Prophet forecast, confidence interval, and budget. Question: how much will we spend?"
        actions={
          <>
            <SegmentedControl
              options={['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual']}
              value={granularity}
              onChange={(v) => setGranularity(v as typeof granularity)}
            />
            <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
              Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-[12px] text-[var(--cs-ink-3)]">Current MTD spend</p>
          <p className="mt-1.5 text-[22px] font-medium tabular-nums">$24,680</p>
          <p className="mt-1 text-[11px] text-[var(--cs-ink-3)]">94.2% of target budget consumed</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--cs-ink-3)]">Projected month-end</p>
          <p className="mt-1.5 text-[22px] font-medium tabular-nums">$29,120</p>
          <p className="mt-1 text-[11px] text-[var(--cs-crit)]">$4,120 above the $25K threshold</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--cs-ink-3)]">Model variance (MAPE)</p>
          <p className="mt-1.5 text-[22px] font-medium tabular-nums">±2.4%</p>
          <p className="mt-1 text-[11px] text-[var(--cs-ink-3)]">Prophet accuracy on this series</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--cs-ink-3)]">Potential savings</p>
          <p className="mt-1.5 text-[22px] font-medium tabular-nums">$6,840 / mo</p>
          <p className="mt-1 text-[11px] text-[var(--cs-ok)]">Across 4 rightsizing recommendations</p>
        </Card>
      </div>

      {/* Main Prophet Forecast Visualization */}
      <Card>
        <CardHeader
          title={`Financial Intelligence Forecast (${granularity} View)`}
          subtitle="Prophet time-series decomposition showing baseline, trend projection, upper/lower bounds"
        />

        <div className="h-96 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecast} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--cs-line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }} stroke="var(--cs-line)" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }} stroke="var(--cs-line)" tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--cs-surface)',
                  border: '1px solid var(--cs-line)',
                  borderRadius: 4,
                  fontSize: 12,
                  color: 'var(--cs-ink)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={900} label={{ value: 'Daily budget $900', fill: 'var(--cs-crit)', fontSize: 11 }} stroke="var(--cs-crit)" strokeDasharray="4 4" />
              
              <Area type="monotone" dataKey="confidenceUpper" name="Upper 95%" stroke="none" fill="#1a73e8" fillOpacity={0.08} />
              <Area type="monotone" dataKey="confidenceLower" name="Lower 95%" stroke="none" fill="#ffffff" fillOpacity={0} />
              
              <Line type="monotone" dataKey="actualCost" name="Actual" stroke="#1a73e8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="forecastCost" name="Prophet forecast" stroke="#5f6368" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* "Why is Spend Changing?" XAI Root Cause Explanation Panel */}
      <Card>
        <CardHeader
          title="Why is spend changing? (XAI Root Cause Analysis)"
          subtitle="SHAP feature attribution explaining key factors behind recent cost growth"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-muted)]">
            <p className="text-[12px] font-medium text-[var(--cs-crit)]">EC2 provisioning (+18.5%)</p>
            <p className="text-[12px] text-[var(--cs-ink-3)] mt-1.5 leading-relaxed">
              Unscaled <code className="font-mono text-[11px]">c5.4xlarge</code> nodes in ap-south-1 after a load test without scale-down.
            </p>
          </div>
          <div className="p-3 rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-muted)]">
            <p className="text-[12px] font-medium text-[var(--cs-crit)]">EBS GP2 surcharge (+12.1%)</p>
            <p className="text-[12px] text-[var(--cs-ink-3)] mt-1.5 leading-relaxed">
              Unattached volume <code className="font-mono text-[11px]">vol-0941fca8291a104</code> idle for 42 days ($215/mo).
            </p>
          </div>
          <div className="p-3 rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-muted)]">
            <p className="text-[12px] font-medium text-[var(--cs-ok)]">RDS rightsizing (−6.4%)</p>
            <p className="text-[12px] text-[var(--cs-ink-3)] mt-1.5 leading-relaxed">
              Read-replica resized from <code className="font-mono text-[11px]">db.r5.xlarge</code>, saving $640/month.
            </p>
          </div>
          <div className="p-3 rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-muted)]">
            <p className="text-[12px] font-medium text-[var(--cs-warn)]">NAT Gateway cross-AZ egress</p>
            <p className="text-[12px] text-[var(--cs-ink-3)] mt-1.5 leading-relaxed">
              12.4 TB S3 transfer over a public NAT gateway because a VPC gateway endpoint is missing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
