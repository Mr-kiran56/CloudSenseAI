import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { ApprovalItem } from '../types';
import { CheckSquare, Check, X, Clock, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getApprovals();
        setApprovals(res.data);
      } catch (err) {
        console.error('Failed to load approvals:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  const canApprove = hasPermission('approve');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Human-in-the-Loop Approval Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Governance sign-off inbox for automated Boto3 AWS cloud remediation proposals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning">{approvals.filter((a) => a.status === 'pending').length} Pending Sign-offs</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {approvals.map((item) => (
          <Card key={item.id} className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Pending Approval</Badge>
                  <RiskBadge risk={item.risk} />
                  <span className="font-mono text-slate-400 text-[10px]">Expires: {item.expiresAt}</span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</h3>
                <p className="text-slate-600 dark:text-slate-300">{item.evidenceSummary}</p>
                <p className="text-[10px] text-slate-400">Requested by: <strong className="text-indigo-400">{item.requester}</strong> at {item.requestedAt}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-slate-800">
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-400 block">ESTIMATED ROI</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">+${item.estimatedSavings}/mo</span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canApprove}
                  onClick={() => navigate(`/recommendations/${item.recommendationId}`)}
                >
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
