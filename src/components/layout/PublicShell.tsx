import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../brand/Logo';
import { useAuth } from '../../context/AuthContext';

export const PublicShell: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-[13px] px-2 py-1 rounded-[4px] ${
      isActive ? 'text-[var(--cs-brand)] font-medium' : 'text-[var(--cs-ink-2)] hover:text-[var(--cs-ink)]'
    }`;

  return (
    <div className="min-h-screen bg-[var(--cs-bg)] text-[var(--cs-ink)] flex flex-col">
      <header className="sticky top-0 z-30 h-14 bg-[var(--cs-surface)] border-b border-[var(--cs-line)]">
        <div className="mx-auto max-w-[1120px] h-full px-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="CloudSense AI home">
            <Logo size={28} withWordmark compact />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/product" className={linkCls}>
              Product
            </NavLink>
            <NavLink to="/architecture" className={linkCls}>
              Architecture
            </NavLink>
            <NavLink to="/research" className={linkCls}>
              Research
            </NavLink>
            <NavLink to="/docs" className={linkCls}>
              Documentation
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="h-9 px-4 inline-flex items-center rounded-[4px] bg-[var(--cs-brand)] text-white text-[13px] font-medium"
              >
                Open console
              </Link>
            ) : (
              <>
                <Link to="/login" className="h-9 px-3 inline-flex items-center text-[13px] text-[var(--cs-brand)]">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="h-9 px-4 inline-flex items-center rounded-[4px] bg-[var(--cs-brand)] text-white text-[13px] font-medium"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--cs-line)] bg-[var(--cs-surface)]">
        <div className="mx-auto max-w-[1120px] px-4 py-8 grid sm:grid-cols-3 gap-6 text-[13px] text-[var(--cs-ink-3)]">
          <div>
            <Logo size={24} withWordmark compact />
            <p className="mt-3 max-w-xs leading-relaxed">
              Final-year research project: intelligent cloud resource and cost optimization with explainable AI and
              governed AWS remediation.
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--cs-ink)] mb-2">Platform</p>
            <div className="space-y-1.5">
              <Link to="/architecture" className="block hover:text-[var(--cs-ink)]">
                ML architecture
              </Link>
              <Link to="/research" className="block hover:text-[var(--cs-ink)]">
                Problem &amp; contribution
              </Link>
              <Link to="/docs" className="block hover:text-[var(--cs-ink)]">
                How remediation works
              </Link>
            </div>
          </div>
          <div>
            <p className="font-medium text-[var(--cs-ink)] mb-2">Safety</p>
            <p className="leading-relaxed">
              The browser never holds AWS secrets and never calls Boto3. Remediation runs only after backend
              authorization and human approval.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
