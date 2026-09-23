import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge, ConfidenceBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ShapFeatureChart } from '../components/ui/ShapFeatureChart';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Recommendation } from '../types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Sliders,
  ShieldAlert,
  HelpCircle,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const RecommendationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { addToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getRecommendations();
        const found = res.data.find((r) => r.id === id) || res.data[0];
        setRecommendation(found);
      } catch (err) {
        console.error('Failed to load recommendation detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading || !recommendation) return <Skeleton className="h-96 w-full" />;

  const canApprove = hasPermission('approve');

  const handleExecuteApproval = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiService.approveRecommendation(recommendation.id, user.name);
      setIsApprovalModalOpen(false);
      setRecommendation((prev) => (prev ? { ...prev, status: 'approved' } : null));

      addToast({
        type: 'success',
        title: 'Recommendation Approved & Dispatched',
        message: `MCP Server initiated AWS Boto3 remediation for ${recommendation.resourceName}. Execution ID: ${res.job.executionId}`,
      });

      // Redirect to remediation control page
      setTimeout(() => {
        navigate('/remediation');
      }, 1000);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: 'Backend remediation server failed to record sign-off.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteRejection = async () => {
    setIsSubmitting(true);
    try {
      await apiService.rejectRecommendation(recommendation.id, rejectReason);
      setIsRejectModalOpen(false);
      setRecommendation((prev) => (prev ? { ...prev, status: 'rejected' } : null));

      addToast({
        type: 'info',
        title: 'Recommendation Rejected',
        message: 'Feedback recorded for model retuning.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/recommendations')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Recommendations
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Sliders className="w-3.5 h-3.5 text-indigo-500" />}
            onClick={() => navigate('/simulator')}
          >
            Simulate First
          </Button>

          {recommendation.status === 'needs_review' && (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
                onClick={() => setIsRejectModalOpen(true)}
              >
                Reject
              </Button>

              <Button
                variant="success"
                size="sm"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                disabled={!canApprove}
                onClick={() => setIsApprovalModalOpen(true)}
              >
                Approve & Execute Remediation
              </Button>
            </>
          )}

          {recommendation.status === 'approved' && (
            <Badge variant="success" icon>Approved & Scheduled</Badge>
          )}
        </div>
      </div>

      {/* Main Title Banner */}
      <Card className="border-l-4 border-l-blue-600 dark:border-l-blue-500">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant={recommendation.status === 'approved' ? 'success' : 'warning'}>
              {recommendation.status.replace('_', ' ')}
            </Badge>
            <ConfidenceBadge confidence={recommendation.aiConfidence} />
            <RiskBadge risk={recommendation.risk} />
            <span className="font-mono text-slate-400">{recommendation.service} • {recommendation.resourceId}</span>
          </div>

          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            {recommendation.title}
          </h1>

          <div className="flex items-center gap-6 pt-2 text-xs font-mono border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px]">ESTIMATED MONTHLY SAVINGS</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+${recommendation.monthlySavings}/mo</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ANNUAL SAVINGS ROI</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">+${recommendation.annualSavings.toLocaleString()}/yr</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid: Details & XAI Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Problem, Root Cause, Evidence, Actions (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem & Root Cause */}
          <Card>
            <CardHeader title="Problem & Root Cause Analysis" />
            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">Identified Inefficiency:</span>
                <p className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-800">
                  {recommendation.problem}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">Root Cause Attribution:</span>
                <p className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-800">
                  {recommendation.rootCause}
                </p>
              </div>
            </div>
          </Card>

          {/* Evidence Metrics Table */}
          <Card>
            <CardHeader title="CloudWatch Empirical Evidence" subtitle="Telemetry baseline comparison" />
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-2.5">Metric</th>
                  <th className="p-2.5">Observed Value</th>
                  <th className="p-2.5">Target Baseline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {recommendation.evidence.map((ev, i) => (
                  <tr key={i}>
                    <td className="p-2.5 font-sans font-semibold text-slate-800 dark:text-slate-200">{ev.metric}</td>
                    <td className="p-2.5 text-blue-600 dark:text-blue-400 font-bold">{ev.value}</td>
                    <td className="p-2.5 text-slate-400">{ev.baseline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Proposed AWS Boto3 Remediation & Rollback Plan */}
          <Card>
            <CardHeader title="Proposed AWS SDK Boto3 Remediation Plan" subtitle="Automated governed API workflow" />
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-900 text-slate-200 font-mono rounded-lg border border-slate-800 space-y-1">
                <div className="text-[10px] text-blue-400 font-semibold">// Boto3 Remediation Command</div>
                <p>{recommendation.recommendedAction}</p>
              </div>

              <div className="p-3 bg-slate-900 text-slate-300 font-mono rounded-lg border border-slate-800 space-y-1">
                <div className="text-[10px] text-amber-400 font-semibold">// Automated Rollback Safeguard</div>
                <p>{recommendation.rollbackAction}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: SHAP Feature Importance & Risk Analysis (1 Col) */}
        <div className="space-y-6">
          <ShapFeatureChart features={recommendation.shapFeatures} />

          <Card>
            <CardHeader title="Impact & Operational Risk Analysis" />
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Performance Impact:</span>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{recommendation.performanceImpact}</p>
              </div>

              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Business Risk:</span>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{recommendation.businessImpact}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Human Approval Confirmation Modal */}
      <Modal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        title="Confirm Governance Approval & Dispatch Remediation"
        subtitle="Require explicit sign-off prior to AWS Boto3 execution"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsApprovalModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleExecuteApproval}
            >
              Sign & Execute Remediation
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-300">
            <strong>State-Changing Action Notice:</strong> You are authorizing CloudSense AI to modify production AWS resource configurations.
          </div>

          <div className="space-y-2 border-y border-slate-100 dark:border-slate-800 py-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Resource:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{recommendation.resourceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Action Type:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{recommendation.service} Rightsizing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Monthly Savings:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+${recommendation.monthlySavings}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rollback Available:</span>
              <span className="font-semibold text-emerald-500">Yes (Automated via Boto3)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Approving User:</span>
              <span className="font-bold text-indigo-500">{user.name} ({user.title})</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Optimization Proposal"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleExecuteRejection}>
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Please provide feedback so the CloudSense AI model can learn your architectural preferences:
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="E.g. Resource is needed for upcoming Q4 marketing spike..."
            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
          />
        </div>
      </Modal>
    </div>
  );
};
