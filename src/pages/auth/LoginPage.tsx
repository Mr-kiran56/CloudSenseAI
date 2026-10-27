import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { GoogleDots } from '../../components/brand/GoogleDots';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  const [email, setEmail] = useState('admin@cloudsense.ai');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Unable to sign in.');
    else navigate(from, { replace: true });
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);
    const res = await login(demoEmail, demoPass);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Unable to sign in.');
    else navigate(from, { replace: true });
  };

  if (isAuthenticated) return <Navigate to={from} replace />;

  return (
    <div className="min-h-screen bg-[var(--cs-bg)] text-[var(--cs-ink)] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      <div className="w-full max-w-[460px] relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-3">
            <Logo size={32} withWordmark />
            <GoogleDots />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-2xl p-8 cs-shadow-md">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-ink)]">Sign in</h1>
            <p className="mt-1 text-sm text-[var(--cs-ink-3)]">to continue to CloudSense AI console</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--cs-ink-2)] uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <input
                className="w-full h-11 px-3.5 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-sm text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)] transition"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-[var(--cs-ink-2)] uppercase tracking-wider">
                  Password
                </label>
              </div>
              <input
                className="w-full h-11 px-3.5 rounded-lg border border-[var(--cs-line)] bg-[var(--cs-surface)] text-sm text-[var(--cs-ink)] placeholder-[var(--cs-ink-3)] focus:outline-none focus:border-[var(--cs-brand)] focus:ring-1 focus:ring-[var(--cs-brand)] transition"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-lg bg-[var(--cs-brand)] hover:bg-[var(--cs-brand-hover)] text-white font-medium text-sm flex items-center justify-center gap-2 transition cs-shadow disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Bar - Strictly ONE Demo Account */}
          <div className="mt-6 pt-6 border-t border-[var(--cs-line)]">
            <p className="text-xs font-semibold text-[var(--cs-ink-3)] uppercase tracking-wider mb-3">
              One-Click Demo Account (Synthesis ML Lab)
            </p>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@cloudsense.ai', 'Admin@123456')}
              className="w-full px-3.5 py-3 rounded-xl bg-[var(--cs-muted)] hover:bg-[var(--cs-line)] border border-[var(--cs-line)] text-left text-xs text-[var(--cs-ink)] flex items-center justify-between group transition"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <div>
                  <span className="font-semibold text-[var(--cs-ink)] block">
                    CloudSense Demo Lab (Synthesis)
                  </span>
                  <span className="text-[var(--cs-ink-3)] block text-[11px]">
                    admin@cloudsense.ai &bull; Pre-loaded with Prophet, XGBoost SHAP &amp; Isolation Forest
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[var(--cs-brand)] opacity-80 group-hover:opacity-100 flex items-center gap-1 font-medium">
                Auto-fill &amp; Login &rarr;
              </span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--cs-ink-3)]">
          Need a custom test environment?{' '}
          <Link to="/signup" className="text-[var(--cs-brand)] hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
