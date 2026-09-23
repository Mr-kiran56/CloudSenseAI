import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge, ConfidenceBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Recommendation } from '../types';
import { Sparkles, ArrowRight, DollarSign, ShieldAlert, CheckCircle2, Sliders, Filter } from 'lucide-react';

export const RecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statusTab, setStatusTab] = useState<string>('needs_review');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getRecommendations();
        setRecommendations(res.data);
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  const filteredRecs = recommendations.filter((r) => statusTab === 'all' || r.status === statusTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
              CloudSense Recommendations Inbox
            </h1>
            <Badge variant="ai" icon>SHAP Explained Optimization Engine</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            AI-generated rightsizing and architectural remediation proposals requiring human governance sign-off
          </p>
        </div>

        <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-md text-xs font-medium">
          {[
            { id: 'needs_review', label: 'Needs Review', count: recommendations.filter((r) => r.status === 'needs_review').length },
            { id: 'approved', label: 'Approved', count: recommendations.filter((r) => r.status === 'approved').length },
            { id: 'all', label: 'All Recommendations', count: recommendations.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                statusTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation Cards List */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => (
          <Card key={rec.id} hoverable onClick={() => navigate(`/recommendations/${rec.id}`)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Badge variant={rec.status === 'approved' ? 'success' : 'warning'}>
                    {rec.status.replace('_', ' ')}
                  </Badge>
                  <ConfidenceBadge confidence={rec.aiConfidence} />
                  <RiskBadge risk={rec.risk} />
                  <span className="font-mono text-slate-400 text-[11px]">{rec.createdAt}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 hover:text-blue-500 transition-colors">
                  {rec.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  <strong>Problem:</strong> {rec.problem}
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  <strong>Root Cause:</strong> {rec.rootCause}
                </p>
              </div>

              {/* Right Side Financial & Actions */}
              <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 shrink-0 justify-between md:justify-end">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Monthly ROI</span>
                  <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    +${rec.monthlySavings}/mo
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    (${rec.annualSavings.toLocaleString()}/yr)
                  </span>
                </div>

                <Button variant="primary" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                  Review Proposal
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
