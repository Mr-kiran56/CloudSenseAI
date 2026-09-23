import React from 'react';

export const ResearchPage: React.FC = () => {
  return (
    <article className="mx-auto max-w-[800px] px-4 py-14">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--cs-ink-3)]">
        Final-year research project
      </p>
      <h1 className="mt-2 text-[32px] leading-tight font-normal tracking-tight">
        Intelligent cloud cost optimization, autonomous remediation, and Denial-of-Wallet mitigation
      </h1>
      <p className="mt-3 text-[14px] text-[var(--cs-ink-3)]">
        Domains: Artificial Intelligence · Machine Learning · Cloud Computing · FinOps · Cloud Security · Explainable
        AI
      </p>

      <h2 className="mt-10 text-[20px] font-normal">Problem</h2>
      <p className="mt-3 text-[15px] leading-7 text-[var(--cs-ink-2)]">
        Organizations provision for peak demand and rarely reclaim idle compute, oversized instances, unattached
        volumes, unused snapshots, and idle databases. Existing platforms mainly chart history and fire alerts. People
        still diagnose waste, estimate savings, and change production by hand. Separately, Denial-of-Wallet attacks
        inflate spend without necessarily taking a service down — a class of financial abuse that availability-centric
        tools often miss.
      </p>

      <h2 className="mt-10 text-[20px] font-normal">Proposed contribution</h2>
      <p className="mt-3 text-[15px] leading-7 text-[var(--cs-ink-2)]">
        CloudSense AI unifies forecasting (Prophet), business-aware unit economics (XGBoost), anomaly and potential
        DoW detection (Isolation Forest), and SHAP explanations into a single recommendation workflow. Remediation is
        autonomous only after human approval, then executed through MCP and AWS SDK (Boto3) with verification and
        audit.
      </p>

      <h2 className="mt-10 text-[20px] font-normal">Objectives</h2>
      <ul className="mt-3 space-y-2 text-[15px] leading-7 text-[var(--cs-ink-2)] list-disc pl-5">
        <li>Forecast cloud expenditure with interpretable confidence bounds.</li>
        <li>Relate spend to product KPIs so optimization is not purely infrastructure-centric.</li>
        <li>Detect abnormal cost and provisioning patterns with cautious DoW language.</li>
        <li>Explain every recommendation with evidence and feature influence.</li>
        <li>Keep production changes behind approval, backend authorization, and an immutable log.</li>
      </ul>
    </article>
  );
};
