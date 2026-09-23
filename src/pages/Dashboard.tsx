import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge, RiskBadge, ConfidenceBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import { PageHeader, SegmentedControl, DemoBanner } from '../components/ui/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { apiService } from '../services/api';
import { DashboardSummary, CostForecastPoint, CostBreakdownItem, Recommendation, Anomaly } from '../types';
import { DollarSign, TrendingUp, Lightbulb, ShieldAlert, Server, ChevronRight, CheckSquare } from 'lucide-react';
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
          apiService.getCostForecast(),
          apiService.getCostBreakdown(),
          apiService.getRecommendations(),
          apiService.getAnomalies(),
        ]);
        setSummary(sumRes.data);
        setForecast(fcRes.data);
        setBreakdown(bdRes.data);
        setRecommendations(recRes.data);
        setAnomalies(anomRes.data);
      } catch {
        /* ErrorState would render if we expand this */
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-5">
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
    borderRadius: 4,
    fontSize: 12,
    color: 'var(--cs-ink)',
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Cloud financial status, forecast, waste, anomalies, and work that still needs a person."
        actions={
          <>
            {isDemoData && <DemoBanner />}
            <SegmentedControl options={['7D', '30D', '90D']} value={timeRange} onChange={setTimeRange} />
            <Button variant="outline" size="sm" onClick={() => navigate('/assistant')}>
              Ask assistant
            </Button>
          </>
        }
      />

      <div className="border border-[var(--cs-line)] rounded-lg bg-[var(--cs-surface)] p-4 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--cs-ink-3)]">Insight</p>
          <p className="mt-1 text-[14px] leading-6 text-[var(--cs-ink)]">{summary.aiInsight}</p>
          <p className="mt-1 text-[12px] text-[var(--cs-ink-3)]">
            Generated from Prophet spend trajectory and service attribution. Open the cost workspace for the series.
          </p>
        </div>
        <button
          onClick={() => navigate('/cost')}
          className="inline-flex items-center text-[13px] text-[var(--cs-brand)] shrink-0"
        >
          View evidence <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {dowAnomaly && (
        <div className="border border-[var(--cs-crit)]/30 bg-[var(--cs-crit-soft)] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium text-[var(--cs-crit)]">Potential DoW activity detected</p>
            <p className="text-[13px] text-[var(--cs-ink-2)] mt-0.5">
              {dowAnomaly.title}. Cost velocity {dowAnomaly.costVelocity}. This is an Isolation Forest signal, not a
              confirmed attack.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => navigate('/anomalies')}>
            Investigate
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <MetricCard
          label="Current spend"
          value={`$${summary.totalSpend.toLocaleString()}`}
          delta={`${summary.spendTrendPercent >= 0 ? '+' : ''}${summary.spendTrendPercent}% vs prior`}
          deltaTone={summary.spendTrendPercent > 0 ? 'bad' : 'good'}
          hint="Selected account, period"
          icon={<DollarSign className="w-4 h-4" />}
          spark={[18, 20, 19, 22, 24, 23, 26]}
          onClick={() => navigate('/cost')}
        />
        <MetricCard
          label="Forecasted spend"
          value={`$${summary.forecastSpend.toLocaleString()}`}
          hint="Prophet month-end projection"
          icon={<TrendingUp className="w-4 h-4" />}
          onClick={() => navigate('/cost')}
        />
        <MetricCard
          label="Potential savings"
          value={`$${summary.potentialSavings.toLocaleString()}`}
          delta="Actionable recommendations"
          deltaTone="good"
          icon={<Lightbulb className="w-4 h-4" />}
          onClick={() => navigate('/recommendations')}
        />
        <MetricCard
          label="Active anomalies"
          value={String(summary.activeAnomaliesCount)}
          hint="Includes potential DoW flags"
          icon={<ShieldAlert className="w-4 h-4" />}
          onClick={() => navigate('/anomalies')}
        />
        <MetricCard
          label="Pending approvals"
          value={String(summary.pendingApprovalsCount)}
          hint="Human-in-the-loop queue"
          icon={<CheckSquare className="w-4 h-4" />}
          onClick={() => navigate('/approvals')}
        />
        <MetricCard
          label="Healthy resources"
          value={String(summary.healthyResourceCount)}
          hint={`${summary.underutilizedResourceCount + summary.idleResourceCount} idle or underused`}
          icon={<Server className="w-4 h-4" />}
          onClick={() => navigate('/resources')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Spend versus forecast"
            subtitle="Actual, Prophet projection, 95% band, and daily budget. Question: how much will we spend?"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/cost')}>
                Open cost workspace
              </Button>
            }
          />
          <div className="h-72 w-full" role="img" aria-label="Cloud spend actual versus Prophet forecast">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--cs-line)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }} stroke="var(--cs-line)" />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--cs-ink-3)' }}
                  stroke="var(--cs-line)"
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number | string) => [val ? `$${val}` : '—', '']} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  y={900}
                  label={{ value: 'Budget $900/d', fill: 'var(--cs-crit)', fontSize: 10 }}
                  stroke="var(--cs-crit)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="actualCost"
                  name="Actual"
                  stroke="#1a73e8"
                  fill="#1a73e8"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="forecastCost"
                  name="Forecast"
                  stroke="#5f6368"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="confidenceUpper"
                  name="Upper 95%"
                  stroke="#9aa0a6"
                  fill="none"
                  strokeWidth={1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Where spend sits" subtitle="Top services this period" />
          <div className="space-y-3">
            {breakdown.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--cs-ink)]">{item.name}</span>
                  <span className="tabular-nums font-medium">${item.cost.toLocaleString()}</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-[var(--cs-muted)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--cs-brand)]" style={{ width: `${item.percentage}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--cs-ink-3)] tabular-nums">
                  {item.percentage}% · {item.changePercent >= 0 ? '+' : ''}
                  {item.changePercent}% vs prior
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <div className="px-4 pt-4">
          <CardHeader
            title="Optimization opportunities"
            subtitle="Highest estimated monthly savings awaiting review"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/recommendations')}>
                All recommendations
              </Button>
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[var(--cs-muted)] text-[11px] uppercase tracking-wide text-[var(--cs-ink-3)]">
              <tr>
                <th className="px-4 py-2 font-medium">Resource</th>
                <th className="px-4 py-2 font-medium">Problem</th>
                <th className="px-4 py-2 font-medium">Monthly save</th>
                <th className="px-4 py-2 font-medium">Confidence</th>
                <th className="px-4 py-2 font-medium">Risk</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cs-line)]">
              {recommendations.slice(0, 4).map((rec) => (
                <tr key={rec.id} className="hover:bg-[var(--cs-muted)]/60">
                  <td className="px-4 py-3">
                    <p className="font-medium">{rec.resourceName}</p>
                    <p className="font-mono text-[11px] text-[var(--cs-ink-3)]">
                      {rec.resourceId} · {rec.service}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate">{rec.problem}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-[var(--cs-ok)]">${rec.monthlySavings}</td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge confidence={rec.aiConfidence} />
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge risk={rec.risk} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={rec.status === 'approved' ? 'success' : 'warning'}>
                      {rec.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/recommendations/${rec.id}`)}>
                      Review
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
