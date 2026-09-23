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
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
              Cost & forecast
            </h1>
            <Badge variant="ai" icon>Prophet Time-Series Engine</Badge>
          </div>
          <p className="text-[13px] text-[var(--cs-ink-3)] mt-1">
            Actual spend, Prophet forecast, confidence interval, and budget. Question: how much will we spend?
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Granularity Switcher */}
          <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-md text-xs font-medium">
            {(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  granularity === g
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
            Export Dataset
          </Button>
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <span className="text-xs text-slate-500">Current MTD Spend</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">$24,680</div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">94.2% of target budget consumed</p>
        </Card>
        <Card>
          <span className="text-xs text-slate-500">Projected Month-End Spend</span>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">$29,120</div>
          <p className="text-[11px] text-rose-500 font-semibold mt-1">+$4,120 above $25K budget threshold</p>
        </Card>
        <Card>
          <span className="text-xs text-slate-500">Model Variance (MAPE)</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">± 2.4%</div>
          <p className="text-[11px] text-slate-400 mt-1">Prophet model accuracy rating</p>
        </Card>
        <Card>
          <span className="text-xs text-slate-500">Potential Savings Opportunities</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">$6,840 / mo</div>
          <p className="text-[11px] text-emerald-500 font-semibold mt-1">Across 4 rightsizing recommendations</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={900} label={{ value: 'Daily Budget Limit ($900)', fill: '#ef4444', fontSize: 11 }} stroke="#ef4444" strokeDasharray="4 4" />
              
              <Area type="monotone" dataKey="confidenceUpper" name="Upper Confidence (95%)" stroke="none" fill="#818cf8" fillOpacity={0.15} />
              <Area type="monotone" dataKey="confidenceLower" name="Lower Confidence (95%)" stroke="none" fill="#ffffff" fillOpacity={0.0} />
              
              <Line type="monotone" dataKey="actualCost" name="Actual Daily Spend" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="forecastCost" name="Prophet Forecasted Spend" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="5 5" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
              <ArrowUpRight className="w-4 h-4" />
              <span>EC2 Provisioning Spikes (+18.5%)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              Un-scaled <code className="text-indigo-400">c5.4xlarge</code> nodes in ap-south-1 running post-load test without AutoScaling scale-down.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
              <ArrowUpRight className="w-4 h-4" />
              <span>EBS GP2 Storage Surcharge (+12.1%)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              42-day unattached orphan GP2 volume <code className="text-indigo-400">vol-0941fca8291a104</code> incurring $215/month idle charges.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>RDS Rightsizing Benefit (-6.4%)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              Executed RDS read-replica rightsizing (<code className="text-emerald-400">db.r5.xlarge</code>) saving $640/month.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>NAT Gateway Cross-AZ Egress</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              12.4 TB S3 data transfer traversing public NAT gateway due to missing VPC Gateway Endpoint.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
