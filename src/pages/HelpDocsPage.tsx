import React from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { PageHeader, Kbd } from '../components/ui/PageHeader';

export const HelpDocsPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Help"
        description="How CloudSense AI reasons, what each workspace is for, and how a change reaches AWS."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Models" />
          <dl className="space-y-3 text-[13px] leading-6 text-[var(--cs-ink-2)]">
            <div>
              <dt className="font-mono text-[var(--cs-brand)]">Prophet</dt>
              <dd>Forecasts expenditure with seasonality and confidence intervals.</dd>
            </div>
            <div>
              <dt className="font-mono text-[var(--cs-brand)]">XGBoost</dt>
              <dd>Predicts unit cost against business KPIs.</dd>
            </div>
            <div>
              <dt className="font-mono text-[var(--cs-brand)]">Isolation Forest</dt>
              <dd>Flags unusual cost and provisioning. Potential DoW is a hypothesis until investigated.</dd>
            </div>
            <div>
              <dt className="font-mono text-[var(--cs-brand)]">SHAP</dt>
              <dd>Shows which features pushed a recommendation or alert.</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Shortcuts" />
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              Command palette <Kbd>Ctrl K</Kbd>
            </div>
            <div className="flex items-center justify-between">
              Shortcuts <Kbd>Ctrl /</Kbd>
            </div>
            <div className="flex items-center justify-between">
              Close <Kbd>Esc</Kbd>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-[var(--cs-ink-3)] leading-6">
            Remediation: recommendation → approval → MCP request → MCP server → Boto3 → AWS → verification → audit.
            The browser never executes Boto3.
          </p>
        </Card>
      </div>
    </div>
  );
};
