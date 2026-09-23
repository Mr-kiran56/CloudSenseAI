import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { AWSAccount } from '../types';
import { Cloud, RefreshCw, Plus, CheckCircle2, ShieldCheck, Key } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CloudAccountsPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getAWSAccounts();
        setAccounts(res.data);
      } catch (err) {
        console.error('Failed to load AWS accounts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Connected AWS Cloud Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            AWS IAM cross-account role authorizations & Boto3 SDK discovery state
          </p>
        </div>

        <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
          Connect AWS Account (IAM Role)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <Card key={acc.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{acc.name}</h3>
                  <p className="text-[10px] font-mono text-slate-400">{acc.accountId}</p>
                </div>
              </div>
              <Badge variant="success" icon>Connected</Badge>
            </div>

            <div className="space-y-2 text-xs border-y border-slate-100 dark:border-slate-800 py-3 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Environment:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 uppercase">{acc.env}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Default Region:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{acc.region}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Discovered Resources:</span>
                <span className="font-semibold text-blue-500">{acc.resourceCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Monthly Spend:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">${acc.monthlySpend.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Last Telemetry Sync:</span>
                <span className="text-slate-500">{acc.lastSync}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() =>
                  addToast({
                    type: 'success',
                    title: 'Cloud Discovery Sync Started',
                    message: `Initiated AWS CloudWatch & Cost Explorer sync for ${acc.name}.`,
                  })
                }
              >
                Sync Now
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
