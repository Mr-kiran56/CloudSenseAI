import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ShapFeatureChart } from '../components/ui/ShapFeatureChart';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { UnitEconomicsMetric } from '../types';
import { PieChart, Sparkles, TrendingUp, Users, Zap, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export const UnitEconomicsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<UnitEconomicsMetric[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState<string>('ue_cost_per_active_user');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getUnitEconomics();
        setMetrics(res.data);
      } catch (err) {
        console.error('Failed to load unit economics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  const activeMetric = metrics.find((m) => m.id === selectedMetricId) || metrics[0];

  const trendData = [
    { month: 'May', unitCost: activeMetric.currentUnitCost * 1.25, volume: activeMetric.kpiVolume * 0.7 },
    { month: 'Jun', unitCost: activeMetric.currentUnitCost * 1.15, volume: activeMetric.kpiVolume * 0.8 },
    { month: 'Jul', unitCost: activeMetric.currentUnitCost * 1.08, volume: activeMetric.kpiVolume * 0.9 },
    { month: 'Aug', unitCost: activeMetric.currentUnitCost * 1.02, volume: activeMetric.kpiVolume * 0.95 },
    { month: 'Sep (Current)', unitCost: activeMetric.currentUnitCost, volume: activeMetric.kpiVolume },
    { month: 'Oct (Predicted)', unitCost: activeMetric.predictedUnitCost, volume: activeMetric.kpiVolume * 1.15 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
              Business-Aware Unit Economics
            </h1>
            <Badge variant="ai" icon>XGBoost Unit Efficiency Model</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connecting raw AWS compute expenditure to core business growth KPIs and tenant density metrics
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-md text-xs font-medium">
          {metrics.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMetricId(m.id)}
              className={`px-3 py-1.5 rounded transition-colors ${
                selectedMetricId === m.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards for Selected Metric */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <span className="text-xs text-slate-500">Current Unit Cost</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            ${activeMetric.currentUnitCost.toFixed(2)} <span className="text-xs font-sans text-slate-400">/ {activeMetric.unitLabel}</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Targeting ${activeMetric.predictedUnitCost.toFixed(2)}</p>
        </Card>

        <Card>
          <span className="text-xs text-slate-500">Business Volume</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {activeMetric.kpiVolume.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />+{activeMetric.kpiGrowthPercent}% growth
          </p>
        </Card>

        <Card>
          <span className="text-xs text-slate-500">Cloud Cost Growth</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            +{activeMetric.costGrowthPercent}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Outpaced by volume growth</p>
        </Card>

        <Card>
          <span className="text-xs text-slate-500">Efficiency Ratio</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {activeMetric.efficiencyRatio}x
          </div>
          <p className="text-[11px] text-emerald-500 font-semibold mt-1">Highly scalable architecture</p>
        </Card>
      </div>

      {/* Main Charts & XGBoost Feature Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unit Cost Trend Chart (2 Cols) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={`${activeMetric.name} Trend & XGBoost Prediction`}
            subtitle="Comparing monthly unit cost progression against total business volume"
          />

          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="unitCost" name={`Unit Cost (${activeMetric.unitLabel})`} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="volume" name="Business KPI Volume" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* XGBoost Feature Importance Attribution (1 Col) */}
        <div className="space-y-4">
          <ShapFeatureChart
            title="XGBoost Unit Cost Attribution"
            features={activeMetric.shapFeatures}
          />

          <Card>
            <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 dark:text-slate-100 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>AI Unit Cost Insight</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your unit cost reduced by <strong>14.2%</strong> this quarter as user volume expanded 24.2%. EC2 AutoScaling spot integration had the single highest positive impact (+0.42 SHAP score) in lowering unit cost per active user.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
