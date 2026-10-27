import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { AWSAccount } from '../types';
import {
  Cloud,
  RefreshCw,
  Plus,
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertCircle,
  Trash2,
  X,
  Server,
  Layers,
  Cpu,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CloudAccountsPage: React.FC = () => {
  const { addToast, refreshAccounts } = useApp();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authMethod, setAuthMethod] = useState<'iam_role' | 'access_keys'>('iam_role');
  const [formData, setFormData] = useState({
    account_id: '',
    name: '',
    alias: '',
    env: 'production',
    region: 'us-east-1',
    role_arn: '',
    access_key_id: '',
    secret_access_key: '',
    external_id: '',
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    arn?: string;
    account_id?: string;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const res = await apiService.getAWSAccounts();
      if (res && res.data) {
        setAccounts(res.data);
      }
    } catch (err) {
      console.error('Failed to load AWS accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    const params: any = {
      region: formData.region,
      role_arn: authMethod === 'iam_role' ? formData.role_arn : undefined,
      access_key_id: authMethod === 'access_keys' ? formData.access_key_id : undefined,
      secret_access_key: authMethod === 'access_keys' ? formData.secret_access_key : undefined,
      external_id: formData.external_id || undefined,
    };

    const res = await apiService.testAWSConnection(params);
    setTestResult(res);
    setTestingConnection(false);

    if (res.success) {
      addToast({
        type: 'success',
        title: 'STS Authentication Verified',
        message: `Connected caller identity ARN: ${res.arn}`,
      });
    } else {
      addToast({
        type: 'warning',
        title: 'AWS STS Verification Warning',
        message: res.error || 'Could not verify caller identity. You may still connect for offline analysis.',
      });
    }
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_id || !formData.name) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Account ID and Name are required.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        account_id: formData.account_id.trim(),
        name: formData.name.trim(),
        alias: formData.alias.trim() || formData.name.toLowerCase().replace(/\s+/g, '-'),
        env: formData.env,
        region: formData.region,
        role_arn: authMethod === 'iam_role' ? formData.role_arn.trim() : undefined,
        access_key_id: authMethod === 'access_keys' ? formData.access_key_id.trim() : undefined,
        secret_access_key: authMethod === 'access_keys' ? formData.secret_access_key.trim() : undefined,
        external_id: formData.external_id.trim() || undefined,
        test_connection: false,
      };

      const res = await apiService.addAWSAccount(payload);
      if (res.success && res.data) {
        addToast({
          type: 'success',
          title: 'AWS Account Connected',
          message: `Successfully connected ${res.data.name} (${res.data.accountId}).`,
        });
        setIsModalOpen(false);
        setFormData({
          account_id: '',
          name: '',
          alias: '',
          env: 'production',
          region: 'us-east-1',
          role_arn: '',
          access_key_id: '',
          secret_access_key: '',
          external_id: '',
        });
        setTestResult(null);
        await loadData();
        await refreshAccounts();
      } else {
        addToast({
          type: 'error',
          title: 'Connection Failed',
          message: res.error || 'Could not register AWS account.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Unexpected Error',
        message: err.message || 'Error occurred while registering account.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async (acc: AWSAccount) => {
    setSyncingId(acc.id);
    try {
      const res = await apiService.syncAWSAccount(acc.id);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Cloud Telemetry Synchronized',
          message: res.message || `Telemetry updated for ${acc.name}.`,
        });
        await loadData();
        await refreshAccounts();
      } else {
        addToast({
          type: 'warning',
          title: 'Telemetry Sync Notice',
          message: res.message || 'Sync completed with warnings.',
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Sync Error',
        message: 'Could not contact AWS API.',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (acc: AWSAccount) => {
    if (acc.isDemo || acc.accountId === 'synthesis-demo') {
      addToast({
        type: 'error',
        title: 'Protected Account',
        message: 'The Synthesis Demo Lab is protected and cannot be disconnected.',
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to disconnect AWS account "${acc.name}" (${acc.accountId})?`)) {
      return;
    }

    try {
      const res = await apiService.deleteAWSAccount(acc.id);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Account Disconnected',
          message: `Disconnected account ${acc.name}.`,
        });
        await loadData();
        await refreshAccounts();
      } else {
        addToast({
          type: 'error',
          title: 'Disconnect Failed',
          message: res.message || 'Could not remove account.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Disconnect Error',
        message: err.message || 'Failed to disconnect account.',
      });
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Connected Cloud Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            AWS IAM cross-account role authorizations, Boto3 SDK collectors, and live ML inference pipelines
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            setIsModalOpen(true);
            setTestResult(null);
          }}
        >
          Connect AWS Account
        </Button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => {
          const isDemo = acc.isDemo || acc.accountId === 'synthesis-demo';

          return (
            <Card key={acc.id} className="space-y-4 relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2.5 rounded-lg ${
                        isDemo
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {isDemo ? <Cpu className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        {acc.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400">{acc.accountId}</p>
                    </div>
                  </div>

                  {isDemo ? (
                    <Badge variant="default" className="bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20 text-[10px]">
                      ML Demo Lab
                    </Badge>
                  ) : (
                    <Badge variant="success" icon className="text-[10px]">
                      Live AWS
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 text-xs border-y border-slate-100 dark:border-slate-800 py-3 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Environment:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 uppercase">
                      {acc.env}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Default Region:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {acc.region}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tracked Resources:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {acc.resourceCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Spend:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      ${(acc.monthlySpend ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Telemetry Status:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {acc.lastSync}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncingId === acc.id}
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${syncingId === acc.id ? 'animate-spin' : ''}`} />}
                  onClick={() => handleSync(acc)}
                >
                  {syncingId === acc.id ? 'Syncing...' : 'Sync Now'}
                </Button>

                {!isDemo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleDisconnect(acc)}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Connect AWS Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--cs-bg-card)] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--cs-ink)]">Connect Real AWS Account</h2>
                  <p className="text-xs text-slate-400">Authorize CloudSense via IAM Cross-Account Role or API Keys</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectAccount} className="p-5 space-y-4">
              {/* Method Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAuthMethod('iam_role')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                    authMethod === 'iam_role'
                      ? 'bg-[var(--cs-bg-card)] text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  IAM Role (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('access_keys')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                    authMethod === 'access_keys'
                      ? 'bg-[var(--cs-bg-card)] text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  Access Keys
                </button>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Account Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp Prod"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">AWS Account ID</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="12-digit ID"
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {authMethod === 'iam_role' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">IAM Role ARN</label>
                    <input
                      type="text"
                      required
                      placeholder="arn:aws:iam::123456789012:role/CloudSenseFinOpsRole"
                      value={formData.role_arn}
                      onChange={(e) => setFormData({ ...formData, role_arn: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">External ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. cloudsense-audit-token"
                      value={formData.external_id}
                      onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">AWS Access Key ID</label>
                    <input
                      type="text"
                      required
                      placeholder="AKIA..."
                      value={formData.access_key_id}
                      onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">AWS Secret Access Key</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={formData.secret_access_key}
                      onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Default Region</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Environment</label>
                  <select
                    value={formData.env}
                    onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="dev">Development</option>
                  </select>
                </div>
              </div>

              {/* STS Connection Test Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 overflow-hidden">
                    <p className="font-semibold">{testResult.success ? 'STS Verification Successful' : 'STS Verification Notice'}</p>
                    {testResult.arn && <p className="font-mono text-[10px] truncate">ARN: {testResult.arn}</p>}
                    {testResult.error && <p className="text-[11px]">{testResult.error}</p>}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingConnection}
                  onClick={handleTestConnection}
                >
                  {testingConnection ? 'Testing STS...' : 'Test STS Connection'}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Connecting...' : 'Connect Account'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
