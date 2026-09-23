import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

export const SignupPage: React.FC = () => {
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cloud_engineer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/welcome" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signup(name, email, password, role);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Unable to create account.');
    else navigate('/welcome', { replace: true });
  };

  const field =
    'mt-1 w-full h-10 px-3 rounded-[4px] border border-[var(--cs-line-strong)] bg-[var(--cs-surface)] text-[14px]';

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-[var(--cs-bg)]">
      <div className="w-full max-w-[480px]">
        <div className="flex justify-center mb-8">
          <Link to="/">
            <Logo size={32} withWordmark />
          </Link>
        </div>
        <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg p-8 cs-shadow">
          <h1 className="text-[24px] font-normal tracking-tight">Create your account</h1>
          <p className="mt-1 text-[14px] text-[var(--cs-ink-3)]">Workspace for this research console (frontend demo).</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block text-[13px] font-medium">
              Full name
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block text-[13px] font-medium">
              Work email
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block text-[13px] font-medium">
              Password
              <input
                className={field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="block text-[13px] font-medium">
              Primary role
              <select className={field} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="admin">Administrator</option>
                <option value="finops_analyst">FinOps analyst</option>
                <option value="cloud_engineer">Cloud engineer</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            {error && (
              <p className="text-[13px] text-[var(--cs-crit)]" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" isLoading={loading}>
              Continue
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-[13px] text-[var(--cs-ink-3)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--cs-brand)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
