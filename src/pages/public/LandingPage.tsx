import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  LineChart,
  ShieldAlert,
  Scale,
  Cpu,
  Lock,
  Workflow,
  CheckCircle2,
} from 'lucide-react';
import { GoogleDots } from '../../components/brand/GoogleDots';

const capabilities = [
  {
    icon: LineChart,
    color: '#4285F4',
    title: 'Forecast spend',
    body: 'Prophet models daily and monthly AWS cost with confidence intervals, seasonality, and budget risk — not a static chart.',
  },
  {
    icon: Scale,
    color: '#34A853',
    title: 'Unit economics',
    body: 'XGBoost connects cloud invoices to product KPIs: cost per user, request, tenant, and transaction.',
  },
  {
    icon: ShieldAlert,
    color: '#EA4335',
    title: 'Anomaly & DoW signals',
    body: 'Isolation Forest flags unusual cost velocity and provisioning. Events are labeled potential Denial-of-Wallet — never assumed malicious.',
  },
  {
    icon: Cpu,
    color: '#FBBC05',
    title: 'Explainable recommendations',
    body: 'Every action includes SHAP feature influence, evidence, savings, risk, and who must approve it.',
  },
];

const pipeline = [
  { step: '01', title: 'Ingest', body: 'Billing, CloudWatch, and business KPIs', accent: '#4285F4' },
  { step: '02', title: 'Models', body: 'Prophet · XGBoost · Isolation Forest', accent: '#EA4335' },
  { step: '03', title: 'XAI', body: 'Confidence, root cause, SHAP, ROI', accent: '#FBBC05' },
  { step: '04', title: 'Approve', body: 'Human-in-the-loop governance', accent: '#34A853' },
  { step: '05', title: 'Remediate', body: 'MCP → backend → Boto3 on AWS', accent: '#4285F4' },
  { step: '06', title: 'Verify', body: 'Audit log and notifications', accent: '#34A853' },
];

export const LandingPage: React.FC = () => {
  return (
    <div>
      <section className="bg-[var(--cs-surface)] border-b border-[var(--cs-line)]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 md:py-20">
          <GoogleDots size="md" />
          <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--cs-ink-3)]">
            FinOps · SecOps · Explainable AI
          </p>
          <h1 className="mt-3 max-w-3xl text-[36px] md:text-[44px] leading-[1.15] font-normal tracking-tight text-[var(--cs-ink)]">
            See cloud spend, understand why it moved, and change AWS only after someone approves it.
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[var(--cs-ink-2)]">
            CloudSense AI is an intelligent cloud resource and cost optimization framework. It forecasts cost,
            scores unit economics, surfaces idle and oversized resources, explains recommendations, and routes
            remediation through Model Context Protocol and AWS SDK (Boto3) on a secure backend.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/signup"
              className="h-10 px-5 inline-flex items-center gap-2 rounded-[4px] bg-[var(--cs-brand)] text-white text-[14px] font-medium"
            >
              Create a workspace <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="h-10 px-5 inline-flex items-center rounded-[4px] border border-[var(--cs-line-strong)] text-[14px] text-[var(--cs-brand)] bg-[var(--cs-surface)]"
            >
              Sign in to console
            </Link>
            <Link to="/architecture" className="h-10 px-3 inline-flex items-center text-[14px] text-[var(--cs-ink-2)]">
              Read the architecture
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-[var(--cs-ink-3)]">
            Console currently runs on labeled demo data. AWS credentials are never stored in the browser.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 py-14">
        <h2 className="text-[22px] font-normal tracking-tight">What the platform answers in seconds</h2>
        <p className="mt-1 text-[14px] text-[var(--cs-ink-3)] max-w-2xl">
          Built as a cloud intelligence command center for engineers, FinOps analysts, and administrators — not a
          generic analytics site.
        </p>
        <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--cs-line)] border border-[var(--cs-line)] rounded-lg overflow-hidden">
          {[
            'How much are we spending?',
            'What will we spend?',
            'Where is money wasted?',
            'Is this a cost anomaly or potential DoW?',
            'Why did the model flag it?',
            'What happens if we apply the change?',
          ].map((q, i) => (
            <li key={q} className="bg-[var(--cs-surface)] p-4 text-[14px]">
              <span
                className="font-mono text-[11px]"
                style={{ color: ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#4285F4', '#34A853'][i] }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-1 text-[var(--cs-ink)]">{q}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[var(--cs-surface)] border-y border-[var(--cs-line)]">
        <div className="mx-auto max-w-[1120px] px-4 py-14">
          <h2 className="text-[22px] font-normal tracking-tight">Capabilities</h2>
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {capabilities.map((c) => (
              <div key={c.title} className="flex gap-4">
                <div
                  className="w-9 h-9 rounded-[4px] text-white grid place-items-center shrink-0"
                  style={{ background: c.color }}
                >
                  <c.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-medium">{c.title}</h3>
                  <p className="mt-1 text-[14px] text-[var(--cs-ink-2)] leading-relaxed">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 py-14">
        <h2 className="text-[22px] font-normal tracking-tight">Decision path</h2>
        <p className="mt-1 text-[14px] text-[var(--cs-ink-3)]">From telemetry to an audited AWS change.</p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {pipeline.map((p) => (
            <div key={p.step} className="border border-[var(--cs-line)] rounded-lg p-3 bg-[var(--cs-surface)]">
              <p className="font-mono text-[11px] font-medium" style={{ color: p.accent }}>
                {p.step}
              </p>
              <p className="mt-1 text-[14px] font-medium">{p.title}</p>
              <p className="mt-1 text-[12px] text-[var(--cs-ink-3)] leading-snug">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[var(--cs-surface)] border-y border-[var(--cs-line)]">
        <div className="mx-auto max-w-[1120px] px-4 py-14 grid md:grid-cols-2 gap-10">
          <div>
            <div className="flex items-center gap-2 text-[var(--cs-brand)]">
              <Lock className="w-4 h-4" />
              <h2 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">Governed remediation</h2>
            </div>
            <p className="mt-3 text-[14px] leading-7 text-[var(--cs-ink-2)]">
              Recommendations never mutate production from the UI. After explicit approval, the frontend asks the
              FastAPI backend to execute an already-authorized operation. MCP carries the request; Boto3 runs on the
              server against EC2, EBS, RDS, Auto Scaling, snapshots, and related services.
            </p>
            <ul className="mt-4 space-y-2 text-[14px] text-[var(--cs-ink-2)]">
              {[
                'Approve, reject, or simulate first',
                'Rollback availability shown before confirm',
                'Immutable audit: who approved, execution ID, result',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#34A853] shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 text-[var(--cs-brand)]">
              <Workflow className="w-4 h-4" />
              <h2 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">Built for this research</h2>
            </div>
            <p className="mt-3 text-[14px] leading-7 text-[var(--cs-ink-2)]">
              The work sits at the intersection of AI, FinOps, and cloud security: idle and oversized infrastructure,
              opaque forecasts, and financial attacks that traditional availability tools miss. CloudSense AI treats
              cost as both an operations and a security signal.
            </p>
            <Link to="/research" className="mt-4 inline-flex items-center gap-1 text-[14px] text-[var(--cs-brand)]">
              Research statement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
