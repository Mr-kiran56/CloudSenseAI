import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { GoogleDots } from '../../components/brand/GoogleDots';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  const [email, setEmail] = useState('kiran@cloudsense.ai');
  const [password, setPassword] = useState('demo');
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

  const field =
    'mt-1 w-full h-10 px-3 rounded-[4px] border border-[var(--cs-line-strong)] bg-[var(--cs-surface)] text-[14px] text-[var(--cs-ink)]';

  if (isAuthenticated) return <Navigate to={from} replace />;

  return (
    <div className="relative z-[1] min-h-screen cs-canvas grid place-items-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <Logo size={32} withWordmark />
            <GoogleDots />
          </Link>
        </div>
        <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg p-8 cs-shadow">
          <h1 className="text-[24px] font-normal tracking-tight">Sign in</h1>
          <p className="mt-1 text-[14px] text-[var(--cs-ink-3)]">to continue to CloudSense AI</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block text-[13px] font-medium">
              Email
              <input
                className={field}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-[13px] font-medium">
              Password
              <input
                className={field}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="text-[13px] text-[var(--cs-crit)]" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" isLoading={loading}>
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-[12px] text-[var(--cs-ink-3)] leading-relaxed">
            Research demo: any valid email signs in locally. Session stores a profile only — never AWS keys.
          </p>
        </div>
        <p className="mt-6 text-center text-[13px] text-[var(--cs-ink-3)]">
          New to CloudSense AI?{' '}
          <Link to="/signup" className="text-[var(--cs-brand)]">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
