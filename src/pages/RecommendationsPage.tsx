import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge, ConfidenceBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Recommendation } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount } = useApp();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statusTab, setStatusTab] = useState<string>('needs_review');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getRecommendations(selectedAccount?.accountId);
        setRecommendations(res.data);
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedAccount?.accountId]);

  if (loading) return <Skeleton className="h-96 w-full" />;

  const filteredRecs = recommendations.filter((r) => statusTab === 'all' || r.status === statusTab);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recommendations"
        description="Rightsizing and remediation proposals that still need a person to approve them."
        actions={
          <div className="inline-flex items-center rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-surface)] p-0.5">
            {[
              { id: 'needs_review', label: 'Needs review' },
              { id: 'approved', label: 'Approved' },
              { id: 'all', label: 'All' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                className={`h-7 px-2.5 text-[12px] rounded-[3px] ${
                  statusTab === tab.id
                    ? 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] font-medium'
                    : 'text-[var(--cs-ink-3)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Recommendation Cards List */}
      {filteredRecs.length > 0 ? (
        <div className="space-y-4">
          {filteredRecs.map((rec) => (
            <Card key={rec.id} hoverable onClick={() => navigate(`/recommendations/${rec.id}`)}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <Badge variant={rec.status === 'approved' ? 'success' : 'warning'}>
                      {rec.status.replace('_', ' ')}
                    </Badge>
                    <ConfidenceBadge confidence={rec.aiConfidence} />
                    <RiskBadge risk={rec.risk} />
                    <span className="font-mono text-[11px] text-[var(--cs-ink-3)]">{rec.createdAt}</span>
                  </div>

                  <h3 className="text-[15px] font-medium text-[var(--cs-ink)]">{rec.title}</h3>
                  <p className="text-[13px] text-[var(--cs-ink-3)] line-clamp-2 leading-relaxed">
                    {rec.problem}
                  </p>
                </div>

                {/* Right Side Financial & Actions */}
                <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-[var(--cs-line)] pt-3 md:pt-0 md:pl-6 shrink-0 justify-between md:justify-end">
                  <div>
                    <span className="text-[11px] text-[var(--cs-ink-3)] block">Monthly savings</span>
                    <span className="text-[18px] font-medium tabular-nums text-[var(--cs-ok)]">
                      +${rec.monthlySavings}/mo
                    </span>
                  </div>

                  <Button variant="primary" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                    Review
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center">
          <h3 className="text-[15px] font-medium text-[var(--cs-ink)]">No pending rightsizing actions</h3>
          <p className="text-[13px] text-[var(--cs-ink-3)] max-w-md mx-auto mt-1.5 leading-relaxed">
            When idle volumes or oversized instances are detected, explained proposals will appear here for approval.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/cloud-accounts')}>
            Open cloud accounts
          </Button>
        </Card>
      )}
    </div>
  );
};
