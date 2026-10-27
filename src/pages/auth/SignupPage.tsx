import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { GoogleDots } from '../../components/brand/GoogleDots';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { UserRole } from '../../types';
import {
  ArrowRight,
  Cloud,
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Sparkles,
} from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // User details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cloud_engineer');

  // AWS Connection Mode: 'real_aws' or 'demo_lab'
  const [connectionMode, setConnectionMode] = useState<'real_aws' | 'demo_lab'>('real_aws');
  const [authMethod, setAuthMethod] = useState<'iam_role' | 'access_keys'>('iam_role');

  // AWS Account Fields
  const [awsAccountId, setAwsAccountId] = useState('');
  const [awsAccountName, setAwsAccountName] = useState('');
  const [awsRoleArn, setAwsRoleArn] = useState('');
  const [awsExternalId, setAwsExternalId] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsEnv, setAwsEnv] = useState('production');

  // STS Testing State
  const [testingSts, setTestingSts] = useState(false);
  const [stsResult, setStsResult] = useState<{
    success?: boolean;
    arn?: string;
    error?: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleTestSts = async () => {
    setTestingSts(true);
    setStsResult(null);

    const params: any = {
      region: awsRegion,
      role_arn: authMethod === 'iam_role' ? awsRoleArn : undefined,
      access_key_id: authMethod === 'access_keys' ? awsAccessKeyId : undefined,
      secret_access_key: authMethod === 'access_keys' ? awsSecretAccessKey : undefined,
      external_id: awsExternalId || undefined,
    };

    const res = await apiService.testAWSConnection(params);
    setStsResult(res);
    setTestingSts(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let awsData = undefined;
    if (connectionMode === 'real_aws') {
      if (!awsAccountId.trim()) {
        setError('Please enter a 12-digit AWS Account ID or switch to "Explore Demo Lab First".');
        setLoading(false);
        return;
      }

      awsData = {
        account_id: awsAccountId.trim(),
        account_name: awsAccountName.trim() || `${name.trim()}'s AWS Workload`,
        role_arn: authMethod === 'iam_role' ? awsRoleArn.trim() : undefined,
        access_key_id: authMethod === 'access_keys' ? awsAccessKeyId.trim() : undefined,
        secret_access_key: authMethod === 'access_keys' ? awsSecretAccessKey.trim() : undefined,
        external_id: awsExternalId.trim() || undefined,
        region: awsRegion,
        env: awsEnv,
      };
    }

    const res = await signup(name, email, password, role, awsData);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Unable to create account.');
    else navigate('/dashboard', { replace: true });
  };

  return (
    <div className="h-screen max-h-screen bg-[var(--cs-bg)] text-[var(--cs-ink)] flex flex-col justify-center items-center px-4 py-3 relative overflow-hidden font-sans">
      <div className="w-full max-w-[560px] h-[86vh] max-h-[640px] flex flex-col relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-2.5 shrink-0 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <Logo size={28} withWordmark />
            <GoogleDots />
          </Link>
        </div>

        {/* Card (Bounded Height - Yellow Box) */}
        <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-2xl cs-shadow-md flex flex-col flex-1 min-h-0 overflow-hidden relative">
          {/* Pinned Header (Clean background, NO hard line, text fades underneath) */}
          <div className="px-6 pt-6 pb-2 shrink-0 bg-[var(--cs-surface)] z-20 relative">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--cs-ink)]">Create FinOps Account</h1>
            <p className="mt-0.5 text-xs text-[var(--cs-ink-3)]">
              Join CloudSense AI and connect your AWS cloud infrastructure
            </p>
          </div>

          {/* Form with Internal Scrollable Body and Soft Gradient Shading */}
          <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {/* Top Shading Gradient (Inputs smoothly fade away as they scroll up) */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[var(--cs-surface)] to-transparent z-10" />

            {/* Scrollable Body - Scrollbar Completely Hidden */}
            <div
              className="flex-1 overflow-y-auto px-6 py-2 space-y-4 no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* 1. User Information */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider">
                  1. User Profile &amp; Role
                </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--cs-ink-2)] mb-1">
                    Full Name
                  </label>
                  <input
                    className="w-full h-10 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-sm text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)] transition"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kiran Punna"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--cs-ink-2)] mb-1">
                    Work Email
                  </label>
                  <input
                    className="w-full h-10 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-sm text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)] transition"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kiran@company.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--cs-ink-2)] mb-1">
                    Password
                  </label>
                  <input
                    className="w-full h-10 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-sm text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)] transition"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--cs-ink-2)] mb-1">
                    FinOps Role &amp; Authority
                  </label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-sm text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)] transition"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                  >
                    <option value="admin">Administrator (Full Approval Authority)</option>
                    <option value="finops_analyst">FinOps Analyst (Forecasts &amp; SHAP)</option>
                    <option value="cloud_engineer">Cloud Engineer (Infrastructure Explorer)</option>
                    <option value="viewer">Executive Viewer (Read-only)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. AWS Account Connection Selector */}
            <div className="pt-2 border-t border-[var(--cs-line)] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider">
                  2. AWS Cloud Connection
                </p>
                <span className="text-[11px] text-[var(--cs-brand)] flex items-center gap-1 font-medium">
                  <Sparkles size={12} /> Live Ingestion
                </span>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--cs-muted)] rounded-xl border border-[var(--cs-line)]">
                <button
                  type="button"
                  onClick={() => setConnectionMode('real_aws')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                    connectionMode === 'real_aws'
                      ? 'bg-[var(--cs-surface)] text-[var(--cs-brand)] shadow-sm font-semibold border border-[var(--cs-line)]'
                      : 'text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
                  }`}
                >
                  <Cloud size={14} />
                  Connect Real AWS Account
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionMode('demo_lab')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                    connectionMode === 'demo_lab'
                      ? 'bg-[var(--cs-surface)] text-purple-600 dark:text-purple-400 shadow-sm font-semibold border border-[var(--cs-line)]'
                      : 'text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
                  }`}
                >
                  <FlaskConical size={14} />
                  Explore Demo Lab First
                </button>
              </div>

              {/* Real AWS Connection Form */}
              {connectionMode === 'real_aws' ? (
                <div className="p-4 rounded-xl bg-[var(--cs-muted)]/50 border border-[var(--cs-line)] space-y-3">
                  {/* Method Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('iam_role')}
                      className={`py-1.5 px-2.5 text-xs rounded-lg flex items-center justify-center gap-1.5 border transition ${
                        authMethod === 'iam_role'
                          ? 'border-[var(--cs-brand)] bg-[var(--cs-surface)] text-[var(--cs-brand)] font-semibold'
                          : 'border-transparent text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
                      }`}
                    >
                      <ShieldCheck size={13} />
                      IAM Role (Cross-Account)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('access_keys')}
                      className={`py-1.5 px-2.5 text-xs rounded-lg flex items-center justify-center gap-1.5 border transition ${
                        authMethod === 'access_keys'
                          ? 'border-[var(--cs-brand)] bg-[var(--cs-surface)] text-[var(--cs-brand)] font-semibold'
                          : 'border-transparent text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
                      }`}
                    >
                      <Key size={13} />
                      Access Keys
                    </button>
                  </div>

                  {/* Account Name and Account ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                        AWS Account ID (12 Digits)
                      </label>
                      <input
                        className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs font-mono text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)]"
                        placeholder="e.g. 123456789012"
                        maxLength={12}
                        value={awsAccountId}
                        onChange={(e) => setAwsAccountId(e.target.value)}
                        required={connectionMode === 'real_aws'}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                        Account Display Name
                      </label>
                      <input
                        className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)]"
                        placeholder="e.g. Acme Production Main"
                        value={awsAccountName}
                        onChange={(e) => setAwsAccountName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Method specific inputs */}
                  {authMethod === 'iam_role' ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                          Cross-Account IAM Role ARN
                        </label>
                        <input
                          className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs font-mono text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)]"
                          placeholder="arn:aws:iam::123456789012:role/CloudSenseRole"
                          value={awsRoleArn}
                          onChange={(e) => setAwsRoleArn(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                          External ID (Optional)
                        </label>
                        <input
                          className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs font-mono text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)]"
                          placeholder="cloudsense-verification-token"
                          value={awsExternalId}
                          onChange={(e) => setAwsExternalId(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                          AWS Access Key ID
                        </label>
                        <input
                          className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs font-mono text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)]"
                          placeholder="AKIA..."
                          value={awsAccessKeyId}
                          onChange={(e) => setAwsAccessKeyId(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                          AWS Secret Access Key
                        </label>
                        <input
                          type="password"
                          className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs font-mono text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)]"
                          placeholder="••••••••••••••••"
                          value={awsSecretAccessKey}
                          onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Region & Environment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                        Primary AWS Region
                      </label>
                      <select
                        className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)]"
                        value={awsRegion}
                        onChange={(e) => setAwsRegion(e.target.value)}
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">EU (Ireland)</option>
                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--cs-ink-2)] mb-1">
                        Environment
                      </label>
                      <select
                        className="w-full h-9 px-3 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-xs text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)]"
                        value={awsEnv}
                        onChange={(e) => setAwsEnv(e.target.value)}
                      >
                        <option value="production">Production</option>
                        <option value="staging">Staging</option>
                        <option value="dev">Development</option>
                      </select>
                    </div>
                  </div>

                  {/* STS Pre-flight Connection Test */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--cs-line)]">
                    <button
                      type="button"
                      disabled={testingSts}
                      onClick={handleTestSts}
                      className="px-3 py-1.5 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] hover:bg-[var(--cs-muted)] text-[11px] font-medium text-[var(--cs-ink-2)] flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {testingSts ? (
                        <>
                          <div className="w-3 h-3 border-2 border-[var(--cs-brand)]/30 border-t-[var(--cs-brand)] rounded-full animate-spin" />
                          <span>Testing STS...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={12} className="text-[var(--cs-brand)]" />
                          <span>Test STS Credentials</span>
                        </>
                      )}
                    </button>

                    {stsResult && (
                      <div
                        className={`text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-md ${
                          stsResult.success
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {stsResult.success ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <AlertCircle size={13} />
                        )}
                        <span className="truncate max-w-[200px]">
                          {stsResult.success ? 'Verified STS Caller' : 'Verification notice'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs space-y-1.5">
                  <p className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <FlaskConical size={14} />
                    Instant Demo Lab Access
                  </p>
                  <p className="text-[var(--cs-ink-3)] text-[11px] leading-relaxed">
                    Your account will start pre-connected to the <strong>CloudSense Demo Lab (Synthesis)</strong>,
                    backed by the 3 live ML models (Prophet cost forecasting, XGBoost Unit Economics, and Isolation Forest DoW detection).
                    You can connect your live AWS account at any time from the Cloud Accounts page.
                  </p>
                </div>
              )}
            </div>
            </div>

            {/* Bottom Shading Gradient (Inputs smoothly fade away as they scroll down) */}
            <div className="pointer-events-none absolute bottom-[68px] left-0 right-0 h-6 bg-gradient-to-t from-[var(--cs-surface)] to-transparent z-10" />

            {/* Pinned Bottom Action / Submit Button (Clean background, NO hard line) */}
            <div className="px-6 py-3.5 bg-[var(--cs-surface)] shrink-0 z-20 relative">
              {error && (
                <div
                  className="mb-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-[var(--cs-brand)] hover:bg-[var(--cs-brand-hover)] text-white font-medium text-sm flex items-center justify-center gap-2 transition cs-shadow disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {connectionMode === 'real_aws'
                        ? 'Create Account & Connect AWS'
                        : 'Create Account & Launch Demo Lab'}
                    </span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-2.5 text-center text-xs text-[var(--cs-ink-3)] shrink-0">
          Already registered?{' '}
          <Link to="/login" className="text-[var(--cs-brand)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
