import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { SimulationConfig, SimulationResult } from '../types';
import { Sliders, Sparkles, Play, ArrowRight, DollarSign, TrendingDown, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useApp } from '../context/AppContext';

export const WhatIfSimulatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useApp();
  const [loading, setLoading] = useState(false);

  const [config, setConfig] = useState<SimulationConfig>({
    scenarioType: 'resize_ec2',
    resourceId: 'i-094ab2910c83a71b',
    currentConfig: 'c5.4xlarge (16 vCPU, 32 GB RAM, $384/mo)',
    proposedConfig: 'c5.xlarge (4 vCPU, 8 GB RAM, $136/mo)',
    workloadPattern: 'steady',
    timeHorizonMonths: 12,
  });

  const [result, setResult] = useState<SimulationResult | null>(null);

  async function runSim() {
    setLoading(true);
    try {
      const res = await apiService.runSimulation(config);
      setResult(res);
    } catch (err) {
      console.error('Simulation run error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSim();
  }, [config.scenarioType, config.timeHorizonMonths]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
              What-If Cloud Optimization Simulator
            </h1>
            <Badge variant="ai" icon>Safe Sandbox Environment</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Model rightsizing, storage migration, and auto-scaling ROI prior to submitting governance approvals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" icon font-mono>
            Zero Production Impact Guarantee
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Scenario Configuration (1 Col) */}
        <Card className="space-y-4">
          <CardHeader title="Scenario Configuration" subtitle="Define target cloud modifications" />

          <div className="space-y-4 text-xs">
            {/* Scenario Preset Selector */}
            <div>
              <label className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                Optimization Scenario Type:
              </label>
              <select
                value={config.scenarioType}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    scenarioType: e.target.value as any,
                  }))
                }
                className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="resize_ec2">Downsize Over-provisioned EC2 Instance</option>
                <option value="stop_idle">Terminate Idle Unattached Node</option>
                <option value="gp2_to_gp3">EBS GP2 to GP3 Migration</option>
                <option value="rds_rightsizing">RDS Aurora Replica Rightsizing</option>
              </select>
            </div>

            {/* Current vs Proposed */}
            <div className="space-y-2">
              <div>
                <span className="text-slate-400 block text-[10px]">CURRENT SPECIFICATION</span>
                <input
                  type="text"
                  value={config.currentConfig}
                  onChange={(e) => setConfig({ ...config, currentConfig: e.target.value })}
                  className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">PROPOSED SPECIFICATION</span>
                <input
                  type="text"
                  value={config.proposedConfig}
                  onChange={(e) => setConfig({ ...config, proposedConfig: e.target.value })}
                  className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Time Horizon Slider */}
            <div>
              <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100 mb-1">
                <span>Simulation Time Horizon:</span>
                <span className="font-mono text-blue-500">{config.timeHorizonMonths} Months</span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                value={config.timeHorizonMonths}
                onChange={(e) => setConfig({ ...config, timeHorizonMonths: parseInt(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              isLoading={loading}
              icon={<Play className="w-4 h-4" />}
              onClick={runSim}
            >
              Re-Calculate Simulation
            </Button>
          </div>
        </Card>

        {/* Right Side: Simulation Result Projection (2 Cols) */}
        {result && (
          <div className="lg:col-span-2 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Card>
                <span className="text-slate-400 text-[11px]">Baseline Cost</span>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">${result.currentCost}/mo</p>
              </Card>
              <Card>
                <span className="text-slate-400 text-[11px]">Simulated Cost</span>
                <p className="text-xl font-bold font-mono text-indigo-500">${result.optimizedCost}/mo</p>
              </Card>
              <Card>
                <span className="text-slate-400 text-[11px]">Monthly Savings</span>
                <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">+${result.monthlySavings}/mo</p>
              </Card>
              <Card>
                <span className="text-slate-400 text-[11px]">Projected ROI</span>
                <p className="text-xl font-bold font-mono text-emerald-500">{result.roiPercent}% ROI</p>
              </Card>
            </div>

            {/* Cumulative Savings Graph */}
            <Card>
              <CardHeader
                title="Cumulative Baseline vs Simulated Cost Projection"
                subtitle="Projected financial savings trajectory over chosen time horizon"
              />

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.costComparisonCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="baselineCost" name="Current Baseline Spend" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="simulatedCost" name="Simulated Optimized Spend" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Impact Details & Redirect to Approval */}
            <Card>
              <CardHeader title="Simulated Performance & Risk Assessment" />
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
                  <strong>Utilization Impact:</strong> {result.utilizationImpact}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
                  <strong>Performance Impact:</strong> {result.performanceImpact}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <RiskBadge risk={result.riskScore} />
                  <Button
                    variant="success"
                    size="sm"
                    icon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => {
                      addToast({
                        type: 'success',
                        title: 'Simulation Saved',
                        message: 'Redirecting scenario to Governance Approval inbox.',
                      });
                      navigate('/approvals');
                    }}
                  >
                    Submit Scenario for Approval
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
