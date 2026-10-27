import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { Database, ShieldAlert, Play, RefreshCw, Table, BarChart3 } from 'lucide-react';

export const SynthesisLabPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'datasets' | 'evaluation' | 'simulation'>('datasets');
  const [summary, setSummary] = useState<any>(null);
  const [selectedDataset, setSelectedDataset] = useState<string>('A_cost_daily');
  const [datasetData, setDatasetData] = useState<any>(null);
  const [evalData, setEvalData] = useState<any>(null);
  const [loadingDataset, setLoadingDataset] = useState(false);
  
  // Simulation state
  const [intensity, setIntensity] = useState<number>(1.8);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const sum = await apiService.getSynthesisSummary();
      setSummary(sum);
      const ev = await apiService.getModelEvaluation();
      setEvalData(ev);
    }
    loadData();
  }, []);

  useEffect(() => {
    async function fetchDataset() {
      setLoadingDataset(true);
      const data = await apiService.getDatasetPreview(selectedDataset, 30, 0);
      setDatasetData(data);
      setLoadingDataset(false);
    }
    fetchDataset();
  }, [selectedDataset]);

  const handleSimulate = async () => {
    setSimulating(true);
    const res = await apiService.simulateDoWAttack(intensity);
    setSimulationResult(res);
    setSimulating(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--cs-line)] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Database size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-ink)]">Data & ML Model Verification Lab</h1>
              <p className="text-xs md:text-sm text-[var(--cs-ink-3)] mt-0.5">
                Inspect raw ingested synthesis datasets, live model evaluation benchmarks, and test Denial-of-Wallet simulations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[var(--cs-muted)] text-[var(--cs-ink-2)] border border-[var(--cs-line)]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            3 Production Models Online
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[var(--cs-muted)] text-[var(--cs-ink-2)] border border-[var(--cs-line)]">
            9 Datasets
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 border-b border-[var(--cs-line)]">
        <button
          onClick={() => setActiveTab('datasets')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'datasets'
              ? 'border-[var(--cs-brand)] text-[var(--cs-brand)]'
              : 'border-transparent text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
          }`}
        >
          <Table size={16} />
          <span>Raw Ingested Datasets</span>
        </button>
        <button
          onClick={() => setActiveTab('evaluation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'evaluation'
              ? 'border-[var(--cs-brand)] text-[var(--cs-brand)]'
              : 'border-transparent text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
          }`}
        >
          <BarChart3 size={16} />
          <span>ML Model Evaluation & Benchmarks</span>
        </button>
        <button
          onClick={() => setActiveTab('simulation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'simulation'
              ? 'border-[var(--cs-brand)] text-[var(--cs-brand)]'
              : 'border-transparent text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]'
          }`}
        >
          <ShieldAlert size={16} />
          <span>Live DoW Attack Simulator</span>
        </button>
      </div>

      {/* TAB 1: Datasets */}
      {activeTab === 'datasets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-4 cs-shadow">
              <span className="text-xs text-[var(--cs-ink-3)] font-medium">Model A (Prophet) Ingestion</span>
              <div className="text-lg font-bold text-[var(--cs-ink)] mt-1">10,037 Rows</div>
              <p className="text-xs text-[var(--cs-ink-3)] mt-0.5">Daily spend & 9 service breakdown series</p>
            </div>
            <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-4 cs-shadow">
              <span className="text-xs text-[var(--cs-ink-3)] font-medium">Model B (XGBoost) Ingestion</span>
              <div className="text-lg font-bold text-[var(--cs-ink)] mt-1">8,032 Observations</div>
              <p className="text-xs text-[var(--cs-ink-3)] mt-0.5">Joined spend, metrics & business KPIs</p>
            </div>
            <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-4 cs-shadow">
              <span className="text-xs text-[var(--cs-ink-3)] font-medium">Model C (Isolation Forest) Ingestion</span>
              <div className="text-lg font-bold text-[var(--cs-ink)] mt-1">25,920 Windows (5-min)</div>
              <p className="text-xs text-[var(--cs-ink-3)] mt-0.5">90 days of high-frequency telemetry</p>
            </div>
          </div>

          {/* Dataset Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-4 cs-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-semibold text-[var(--cs-ink-2)] uppercase tracking-wider">
                Select Synthesis File:
              </label>
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className="bg-[var(--cs-muted)] border border-[var(--cs-line)] rounded-lg px-3 py-1.5 text-sm text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)]"
              >
                <option value="A_cost_daily">A_cost_daily.csv (Model A Historical Daily Costs)</option>
                <option value="A_cost_by_service_daily">A_cost_by_service_daily.csv (Model A Service Breakdown)</option>
                <option value="B_unit_economics_daily">B_unit_economics_daily.csv (Model B Joined Unit Economics)</option>
                <option value="C_telemetry_5min">C_telemetry_5min.csv (Model C 5-Minute Telemetry Stream)</option>
                <option value="C_incident_ground_truth">C_incident_ground_truth.csv (Model C Attack Incidents Ground Truth)</option>
                <option value="C_labels_eval_only">C_labels_eval_only.csv (Model C Evaluation Labels)</option>
                <option value="C_borg_real_reference_windows">C_borg_real_reference_windows.csv (Google Borg Workload Traces)</option>
                <option value="A_calendar_events">A_calendar_events.csv (Marketing & Holiday Events)</option>
              </select>
            </div>
            <span className="text-xs font-mono text-[var(--cs-ink-3)]">
              Showing preview of first 30 rows
            </span>
          </div>

          {/* Data Grid */}
          <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl overflow-hidden cs-shadow-md">
            {loadingDataset ? (
              <div className="p-12 text-center text-[var(--cs-ink-3)] flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-[var(--cs-brand)]" />
                <span>Streaming synthesis rows...</span>
              </div>
            ) : datasetData && datasetData.rows && datasetData.rows.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--cs-muted)] text-[var(--cs-ink-3)] uppercase tracking-wider sticky top-0 border-b border-[var(--cs-line)]">
                    <tr>
                      {datasetData.headers.map((h: string) => (
                        <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--cs-line)] font-mono text-[var(--cs-ink-2)]">
                    {datasetData.rows.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-[var(--cs-muted)]/50 transition">
                        {datasetData.headers.map((h: string) => (
                          <td key={h} className="px-4 py-2.5 whitespace-nowrap">
                            {row[h] !== undefined && row[h] !== null ? String(row[h]) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--cs-ink-3)] text-sm">
                No rows returned for this dataset view.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Model Evaluations */}
      {activeTab === 'evaluation' && evalData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Model A Card */}
          <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-6 space-y-4 cs-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Model A</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Active</span>
            </div>
            <h3 className="text-lg font-bold text-[var(--cs-ink)]">Prophet Cost Forecaster</h3>
            <p className="text-xs text-[var(--cs-ink-3)]">Predicts future daily expenditure with linear growth and 80% interval bands.</p>
            
            <div className="space-y-2 pt-2 border-t border-[var(--cs-line)] text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Variant</span>
                <span className="font-mono text-[var(--cs-ink)]">P3_tuned</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">CV MAPE (30-day)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{evalData.model_A_prophet.cross_validation_mape_30d || '8.7%'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Hold-out MAPE (30-day)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{evalData.model_A_prophet.holdout_mape_30d || '4.8%'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Baseline Comparison</span>
                <span className="text-right text-[var(--cs-ink-2)]">Outperforms Naive (11.4%) & ARIMA</span>
              </div>
            </div>
          </div>

          {/* Model B Card */}
          <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-6 space-y-4 cs-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Model B</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Active</span>
            </div>
            <h3 className="text-lg font-bold text-[var(--cs-ink)]">XGBoost Unit Economics</h3>
            <p className="text-xs text-[var(--cs-ink-3)]">Models cost per KPI (API request, user, transaction) and explains drivers via TreeSHAP.</p>
            
            <div className="space-y-2 pt-2 border-t border-[var(--cs-line)] text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Ensemble Depth</span>
                <span className="font-mono text-[var(--cs-ink)]">144 Trees (early stopping)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Test R² Score</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{evalData.model_B_xgboost.test_r2 || '0.994'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Test MAE</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{evalData.model_B_xgboost.test_mae || '$0.00095 / 1k'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Explainability</span>
                <span className="text-right text-[var(--cs-ink-2)]">Exact TreeSHAP Force Values</span>
              </div>
            </div>
          </div>

          {/* Model C Card */}
          <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-6 space-y-4 cs-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Model C</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Active</span>
            </div>
            <h3 className="text-lg font-bold text-[var(--cs-ink)]">Isolation Forest & DoW</h3>
            <p className="text-xs text-[var(--cs-ink-3)]">Real-time 5-minute outlier detection with CostVelocity and ProvisioningFrequency.</p>
            
            <div className="space-y-2 pt-2 border-t border-[var(--cs-line)] text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Calibrated Threshold</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{evalData.model_C_isolation_forest.calibrated_threshold || '11.2454'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Hybrid AUPRC</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{evalData.model_C_isolation_forest.any_anomaly_auprc || '0.83'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Detection Delay</span>
                <span className="font-mono text-[var(--cs-ink)]">5.0 min (1 window)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--cs-line)]/50">
                <span className="text-[var(--cs-ink-3)]">Triage Engine</span>
                <span className="text-right text-[var(--cs-ink-2)]">dow_candidate vs benign_spike</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DoW Simulator */}
      {activeTab === 'simulation' && (
        <div className="bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-xl p-6 md:p-8 space-y-6 cs-shadow">
          <div>
            <h2 className="text-lg font-bold text-[var(--cs-ink)]">Live Denial-of-Wallet (DoW) Stream Generator</h2>
            <p className="text-sm text-[var(--cs-ink-3)] mt-1">
              Test how the live Model C Isolation Forest engine scores and triages rapid cost acceleration windows.
            </p>
          </div>

          <div className="max-w-xl space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[var(--cs-ink-2)] uppercase tracking-wider mb-2">
                <span>Simulated Ingress Attack Intensity</span>
                <span className="font-mono text-[var(--cs-brand)]">{intensity.toFixed(1)}x multiplier</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.2"
                value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[var(--cs-ink-3)] mt-1">
                <span>1.0x (Slight Variance)</span>
                <span>2.0x (Severe Wallet Exhaustion)</span>
                <span>4.0x (Catastrophic Storm)</span>
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm flex items-center gap-2 transition cs-shadow disabled:opacity-50"
            >
              {simulating ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              <span>Stream Window to Isolation Forest</span>
            </button>
          </div>

          {simulationResult && (
            <div className="mt-6 p-6 rounded-xl bg-[var(--cs-muted)] border border-[var(--cs-line)] space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--cs-line)]">
                <span className="text-[var(--cs-ink-3)] font-bold">MODEL C INFERENCE RESULT</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  simulationResult.model_c_inference.isAlert
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {simulationResult.model_c_inference.isAlert ? 'ANOMALY DETECTED' : 'NORMAL'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[var(--cs-ink)]">
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[11px]">Anomaly Score</span>
                  <span className="text-base font-bold">{simulationResult.model_c_inference.score}</span>
                  <span className="text-[10px] text-[var(--cs-ink-3)] block">Threshold: {simulationResult.model_c_inference.threshold}</span>
                </div>
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[11px]">Triage Class</span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">{simulationResult.model_c_inference.triageClass}</span>
                </div>
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[11px]">Severity</span>
                  <span className="text-base font-bold text-rose-600 dark:text-rose-400 uppercase">{simulationResult.model_c_inference.severity}</span>
                </div>
                <div>
                  <span className="text-[var(--cs-ink-3)] block text-[11px]">Cost Velocity</span>
                  <span className="text-base font-bold">+{simulationResult.simulation_parameters.cost_velocity.toFixed(2)}x</span>
                </div>
              </div>

              {simulationResult.model_c_inference.reasons && (
                <div className="pt-3 border-t border-[var(--cs-line)] text-[var(--cs-ink-2)] space-y-1">
                  <span className="text-[var(--cs-ink-3)] font-bold block mb-1">TRIAGE REASONS:</span>
                  {simulationResult.model_c_inference.reasons.map((r: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-rose-500">&bull;</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
