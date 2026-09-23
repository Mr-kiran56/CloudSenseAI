import React from 'react';
import { Link } from 'react-router-dom';

export const DocsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-14">
      <h1 className="text-[32px] font-normal tracking-tight">Documentation</h1>
      <p className="mt-3 text-[15px] leading-7 text-[var(--cs-ink-2)]">
        This frontend talks only to a FastAPI backend. Demo mode is used when APIs are unavailable; every figure is
        labeled accordingly.
      </p>

      <h2 className="mt-10 text-[20px] font-normal">Console map</h2>
      <ul className="mt-3 space-y-2 text-[14px] text-[var(--cs-ink-2)]">
        <li>
          <strong className="text-[var(--cs-ink)]">Dashboard</strong> — spend, forecast, savings, anomalies, approvals,
          resource health.
        </li>
        <li>
          <strong className="text-[var(--cs-ink)]">Cost &amp; forecast</strong> — Prophet series, budget, drivers.
        </li>
        <li>
          <strong className="text-[var(--cs-ink)]">Recommendations</strong> — review workspace with XAI and approval.
        </li>
        <li>
          <strong className="text-[var(--cs-ink)]">Anomalies &amp; DoW</strong> — isolation forest signals and timelines.
        </li>
        <li>
          <strong className="text-[var(--cs-ink)]">Simulator</strong> — what-if only; apply sends you to approval.
        </li>
        <li>
          <strong className="text-[var(--cs-ink)]">Remediation</strong> — MCP / Boto3 job timeline after authorization.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-normal">Keyboard</h2>
      <p className="mt-2 text-[14px] text-[var(--cs-ink-2)]">
        Command palette: Ctrl/Cmd+K. Shortcuts: Ctrl/Cmd+/. Escape closes dialogs.
      </p>

      <p className="mt-10 text-[14px]">
        <Link to="/login" className="text-[var(--cs-brand)]">
          Sign in to the console
        </Link>
      </p>
    </div>
  );
};
