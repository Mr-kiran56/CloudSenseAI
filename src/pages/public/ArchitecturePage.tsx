import React from 'react';

const models = [
  {
    name: 'Prophet',
    role: 'Cost forecasting',
    detail:
      'Time-series model for daily and monthly cloud expenditure with seasonality, trend, and 95% confidence intervals used for budget overrun risk.',
  },
  {
    name: 'XGBoost',
    role: 'Unit economics',
    detail:
      'Gradient boosting that maps infrastructure spend onto business KPIs such as active users, API requests, tenants, and transactions.',
  },
  {
    name: 'Isolation Forest',
    role: 'Anomaly & DoW detection',
    detail:
      'Unsupervised detector for cost velocity, request-rate, and provisioning spikes. High scores indicate unusual behavior, not proven malice.',
  },
  {
    name: 'SHAP / XAI',
    role: 'Explanation',
    detail:
      'Feature attribution for why a recommendation or alert fired: utilization, historical spend, network, workload pattern, and related signals.',
  },
];

export const ArchitecturePage: React.FC = () => {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-14">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--cs-ink-3)]">Technical design</p>
      <h1 className="mt-2 text-[32px] leading-tight font-normal tracking-tight">Architecture</h1>
      <p className="mt-3 text-[16px] leading-7 text-[var(--cs-ink-2)]">
        CloudSense AI is a decision-support control plane. Data is ingested from AWS billing, CloudWatch, and
        business KPIs, transformed into features, scored by three model families, explained, then executed only after
        human approval via MCP and Boto3 on the backend.
      </p>

      <figure className="mt-10 border border-[var(--cs-line)] rounded-lg overflow-hidden bg-[var(--cs-surface)]">
        <figcaption className="px-4 py-2 text-[12px] text-[var(--cs-ink-3)] border-b border-[var(--cs-line)]">
          End-to-end control flow
        </figcaption>
        <pre className="p-4 text-[12px] font-mono leading-6 overflow-x-auto text-[var(--cs-ink-2)]">{`AWS Billing + CloudWatch + Business KPIs
        → Data ingestion & feature engineering
        → Prophet | XGBoost | Isolation Forest
        → XAI (confidence, root cause, SHAP, savings, risk, ROI)
        → Recommendation
        → Human approval
        → MCP client → MCP server → Boto3
        → EC2 / EBS / RDS / related services
        → Verification → Audit log → Notifications`}</pre>
      </figure>

      <h2 className="mt-12 text-[20px] font-normal">Model stack</h2>
      <div className="mt-4 divide-y divide-[var(--cs-line)] border-y border-[var(--cs-line)]">
        {models.map((m) => (
          <div key={m.name} className="py-4 grid sm:grid-cols-[160px_1fr] gap-2">
            <div>
              <p className="font-mono text-[13px] text-[var(--cs-brand)]">{m.name}</p>
              <p className="text-[12px] text-[var(--cs-ink-3)]">{m.role}</p>
            </div>
            <p className="text-[14px] leading-6 text-[var(--cs-ink-2)]">{m.detail}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-[20px] font-normal">Why MCP and Boto3</h2>
      <p className="mt-3 text-[14px] leading-7 text-[var(--cs-ink-2)]">
        The UI does not generate Infrastructure-as-Code from the browser and does not call AWS. After approval, the
        FastAPI service issues an MCP request. The MCP server performs Boto3 operations such as stopping idle EC2,
        resizing instances, deleting unattached volumes, cleaning snapshots, and adjusting Auto Scaling — then writes
        an execution record the console can display.
      </p>
    </div>
  );
};
