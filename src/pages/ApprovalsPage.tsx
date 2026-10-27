import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { ApprovalItem } from '../types';
import { CheckSquare, Check, X, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const handleApprove = async (item: ApprovalItem) => {
    setProcessingId(item.id);
    try {
      const res = await apiService.approveRecommendation(item.recommendationId, user.name);
      if (res.success) {
        setApprovals((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, status: 'approved' as const } : a))
        );
        addToast({
          type: 'success',
          title: 'Approval Cryptographically Signed',
          message: `Approved ${item.title}. MCP remediation job queued with AWS Boto3.`,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: 'Could not record approval on backend.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: ApprovalItem) => {
    setProcessingId(item.id);
    try {
      await apiService.rejectRecommendation(item.recommendationId, 'Rejected by operator');
      setApprovals((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: 'rejected' as const } : a))
      );
      addToast({
        type: 'info',
        title: 'Recommendation Rejected',
        message: `Action on ${item.resourceName} was dismissed.`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const canApprove = hasPermission('approve');
  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--cs-line)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-ink)]">
            Human-in-the-Loop Approval Queue
          </h1>
          <p className="text-xs text-[var(--cs-ink-3)] mt-1">
            Mandatory human review inbox before any state-changing Boto3 operation on AWS infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {pendingCount} Pending Sign-offs
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {approvals.map((item) => (
          <Card key={item.id} className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'critical' : 'warning'}>
                    {item.status.toUpperCase()}
                  </Badge>
                  <RiskBadge risk={item.risk} />
                  <span className="font-mono text-[var(--cs-ink-3)] text-[11px]">Expires: {item.expiresAt}</span>
                </div>

                <h3 className="text-base font-bold text-[var(--cs-ink)]">{item.title}</h3>
                <p className="text-[var(--cs-ink-2)] text-xs leading-relaxed">{item.evidenceSummary}</p>
                <div className="flex items-center gap-2 text-[11px] text-[var(--cs-ink-3)] font-mono mt-1">
                  <span>Target: <strong className="text-[var(--cs-brand)]">{item.resourceId}</strong></span>
                  <span>&bull;</span>
                  <span>Requested by: <strong className="text-indigo-600 dark:text-indigo-400">{item.requester}</strong> ({item.requestedAt})</span>
                </div>
              </div>

              <div className="flex items-center gap-5 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[var(--cs-line)]">
                <div className="text-right font-mono">
                  <span className="text-[10px] text-[var(--cs-ink-3)] block uppercase font-semibold">ESTIMATED RECOVERY</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+${item.estimatedSavings}/mo</span>
                </div>

                {item.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!canApprove || processingId === item.id}
                      onClick={() => handleApprove(item)}
                    >
                      <Check size={14} className="mr-1" />
                      <span>Approve & Execute</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canApprove || processingId === item.id}
                      onClick={() => handleReject(item)}
                    >
                      <X size={14} className="mr-1" />
                      <span>Reject</span>
                    </Button>
                  </div>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg bg-[var(--cs-muted)] border border-[var(--cs-line)] text-[var(--cs-ink-2)] font-mono text-xs font-semibold">
                    Decision: {item.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
