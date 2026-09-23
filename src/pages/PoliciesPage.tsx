import React, { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const policies = [
  {
    id: 'pol-idle-ec2',
    name: 'Idle EC2 stop after 14 days',
    scope: 'production, staging',
    requires: 'FinOps analyst or Admin',
    riskCap: 'Medium',
    enabled: true,
  },
  {
    id: 'pol-ebs-unattached',
    name: 'Unattached EBS snapshot then delete',
    scope: 'non-production',
    requires: 'Cloud engineer',
    riskCap: 'Low',
    enabled: true,
  },
  {
    id: 'pol-dow-freeze',
    name: 'Potential DoW: freeze new provisioning',
    scope: 'all accounts',
    requires: 'Admin dual control',
    riskCap: 'High',
    enabled: true,
  },
  {
    id: 'pol-rds-resize',
    name: 'RDS downsize only with simulation',
    scope: 'production',
    requires: 'Admin',
    riskCap: 'High',
    enabled: false,
  },
];

export const PoliciesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useApp();
  const [rows, setRows] = useState(policies);
  const canEdit = hasPermission('edit_policy');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Governance"
        title="Policies"
        description="Guardrails for which recommendations may be approved and executed. Enforcement lives on the backend; this view is the operator contract."
      />
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[var(--cs-muted)] text-[11px] uppercase tracking-wide text-[var(--cs-ink-3)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Policy</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Approver</th>
                <th className="px-4 py-2.5 font-medium">Risk cap</th>
                <th className="px-4 py-2.5 font-medium">State</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cs-line)]">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--cs-ink)]">{p.name}</p>
                    <p className="font-mono text-[11px] text-[var(--cs-ink-3)]">{p.id}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--cs-ink-2)]">{p.scope}</td>
                  <td className="px-4 py-3">{p.requires}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.riskCap === 'High' ? 'warning' : 'neutral'}>{p.riskCap}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.enabled ? 'success' : 'neutral'} icon>
                      {p.enabled ? 'Enforced' : 'Paused'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canEdit}
                      onClick={() => {
                        setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, enabled: !r.enabled } : r)));
                        addToast({
                          type: 'info',
                          title: 'Policy change requested',
                          message: 'Frontend recorded intent. Backend must persist and enforce.',
                        });
                      }}
                    >
                      {p.enabled ? 'Pause' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
