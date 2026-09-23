import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { RemediationJob } from '../types';
import { PlayCircle, CheckCircle2, Clock, AlertTriangle, Workflow, ShieldCheck, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RemediationCenterPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<RemediationJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<RemediationJob | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getRemediationJobs();
        setJobs(res.data);
        if (res.data.length > 0) setSelectedJob(res.data[0]);
      } catch (err) {
        console.error('Failed to load remediation jobs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
              Remediation Operations Control Center
            </h1>
            <Badge variant="ai" icon>MCP Server + Boto3 SDK Protocol</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Governed cloud remediation pipeline tracking execution timelines from human sign-off to AWS SDK execution
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List (1 Col) */}
        <Card className="p-0 overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-xs text-slate-900 dark:text-slate-100">
            Execution Log Jobs ({jobs.length})
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`p-3.5 cursor-pointer text-xs space-y-1.5 transition-colors ${
                  selectedJob?.id === job.id
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant={job.status === 'completed' ? 'success' : 'warning'}>
                    {job.status.toUpperCase()}
                  </Badge>
                  <span className="font-mono text-[10px] text-slate-400">{job.executionId}</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{job.actionName}</p>
                <p className="text-[10px] font-mono text-slate-400">{job.resourceName}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Selected Job Execution Timeline Visualizer (2 Cols) */}
        {selectedJob ? (
          <Card className="lg:col-span-2 space-y-6">
            <CardHeader
              title={selectedJob.actionName}
              subtitle={`Execution ID: ${selectedJob.executionId} • Target: ${selectedJob.resourceName}`}
              action={
                <Badge variant={selectedJob.status === 'completed' ? 'success' : 'warning'}>
                  {selectedJob.status.toUpperCase()}
                </Badge>
              }
            />

            {/* Execution Details Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">REQUESTED BY</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedJob.requestedBy}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">APPROVED BY</span>
                <span className="font-semibold text-indigo-500">{selectedJob.approvedBy}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">STARTED AT</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{selectedJob.startedAt}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">COMPLETED AT</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{selectedJob.completedAt || 'Running...'}</span>
              </div>
            </div>

            {/* Result Summary */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
              <strong>Execution Result Summary:</strong> {selectedJob.resultSummary}
            </div>

            {/* Visual Execution Pipeline (MCP -> Boto3 -> AWS) */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Workflow className="w-4 h-4 text-blue-500" />
                <span>MCP Client → Boto3 SDK Protocol Timeline</span>
              </h4>

              <div className="space-y-3 relative pl-6 border-l-2 border-slate-200 dark:border-slate-800">
                {selectedJob.executionTimeline.map((item, idx) => (
                  <div key={idx} className="relative space-y-1">
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{item.step}</span>
                      <span className="font-mono text-[10px] text-slate-400">{item.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300">
                        {item.agent}
                      </span>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rollback Trigger */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5 text-amber-500" />}
                onClick={() =>
                  addToast({
                    type: 'warning',
                    title: 'Rollback Dispatch Initiated',
                    message: `Dispatched Boto3 rollback request for ${selectedJob.resourceName}.`,
                  })
                }
              >
                Initiate Boto3 Rollback
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
};
