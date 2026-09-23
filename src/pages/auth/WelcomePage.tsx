import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2 } from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const { user } = useAuth();

  const steps = [
    {
      title: 'Workspace is ready',
      body: `Signed in as ${user.name}. Role: ${user.role.replace('_', ' ')}. Frontend role hiding is not security.`,
    },
    {
      title: 'Demo environment attached',
      body: 'Account prod-core (masked) in ap-south-1 is preloaded. Live IAM roles are managed only on the backend.',
    },
    {
      title: 'Models in this console',
      body: 'Prophet for forecast, XGBoost for unit cost, Isolation Forest for anomalies, SHAP for explanations.',
    },
  ];

  return (
    <div className="relative z-[1] min-h-screen cs-canvas grid place-items-center px-4 py-10">
      <div className="w-full max-w-[560px] bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg p-8 cs-shadow">
        <Logo size={28} withWordmark />
        <h1 className="mt-6 text-[24px] font-normal tracking-tight">Welcome to CloudSense AI</h1>
        <p className="mt-2 text-[14px] text-[var(--cs-ink-3)] leading-relaxed">
          This console is the operator surface for the research framework. Spend a minute on the dashboard, then open
          a recommendation and read the explanation before anything is approved.
        </p>
        <ol className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-[var(--cs-ok)] shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium">
                  {i + 1}. {s.title}
                </p>
                <p className="text-[13px] text-[var(--cs-ink-3)] mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link
          to="/dashboard"
          className="mt-8 h-10 px-4 inline-flex items-center rounded-[4px] bg-[var(--cs-brand)] text-white text-[14px] font-medium"
        >
          Enter console
        </Link>
      </div>
    </div>
  );
};
