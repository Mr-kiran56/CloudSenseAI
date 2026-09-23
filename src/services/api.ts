import {
  DashboardSummary,
  CostForecastPoint,
  CostBreakdownItem,
  UnitEconomicsMetric,
  CloudResource,
  Recommendation,
  Anomaly,
  RemediationJob,
  ApprovalItem,
  AuditEvent,
  Notification,
  Integration,
  SimulationConfig,
  SimulationResult,
  AWSAccount,
  UserProfile,
} from '../types';

import {
  mockDashboardSummary,
  mockForecastPoints,
  mockCostBreakdownServices,
  mockUnitEconomicsMetrics,
  mockCloudResources,
  mockRecommendations,
  mockAnomalies,
  mockRemediationJobs,
  mockApprovalItems,
  mockAuditEvents,
  mockNotifications,
  mockIntegrations,
  mockAWSAccounts,
  mockUserProfile,
} from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const USE_DEMO_DATA = true; // Default fallback to rich demo mode if API server is not attached

async function fetchJson<T>(endpoint: string, fallback: T): Promise<{ data: T; isDemo: boolean }> {
  if (!API_BASE_URL || USE_DEMO_DATA) {
    // Artificial latency for realistic async state simulation (50-150ms)
    await new Promise((res) => setTimeout(res, 80));
    return { data: fallback, isDemo: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return { data, isDemo: false };
  } catch (err) {
    console.warn(`[CloudSense API] Endpoint ${endpoint} failed, falling back to Demo Mode data:`, err);
    return { data: fallback, isDemo: true };
  }
}

export const apiService = {
  async getUserProfile(): Promise<{ data: UserProfile; isDemo: boolean }> {
    return fetchJson('/api/v1/user/profile', mockUserProfile);
  },

  async getAWSAccounts(): Promise<{ data: AWSAccount[]; isDemo: boolean }> {
    return fetchJson('/api/v1/cloud-accounts', mockAWSAccounts);
  },

  async getDashboardSummary(): Promise<{ data: DashboardSummary; isDemo: boolean }> {
    return fetchJson('/api/v1/dashboard/summary', mockDashboardSummary);
  },

  async getCostForecast(): Promise<{ data: CostForecastPoint[]; isDemo: boolean }> {
    return fetchJson('/api/v1/cost/forecast', mockForecastPoints);
  },

  async getCostBreakdown(): Promise<{ data: CostBreakdownItem[]; isDemo: boolean }> {
    return fetchJson('/api/v1/cost/breakdown', mockCostBreakdownServices);
  },

  async getUnitEconomics(): Promise<{ data: UnitEconomicsMetric[]; isDemo: boolean }> {
    return fetchJson('/api/v1/unit-economics', mockUnitEconomicsMetrics);
  },

  async getResources(): Promise<{ data: CloudResource[]; isDemo: boolean }> {
    return fetchJson('/api/v1/resources', mockCloudResources);
  },

  async getRecommendations(): Promise<{ data: Recommendation[]; isDemo: boolean }> {
    return fetchJson('/api/v1/recommendations', mockRecommendations);
  },

  async getAnomalies(): Promise<{ data: Anomaly[]; isDemo: boolean }> {
    return fetchJson('/api/v1/anomalies', mockAnomalies);
  },

  async getRemediationJobs(): Promise<{ data: RemediationJob[]; isDemo: boolean }> {
    return fetchJson('/api/v1/remediation/jobs', mockRemediationJobs);
  },

  async getApprovals(): Promise<{ data: ApprovalItem[]; isDemo: boolean }> {
    return fetchJson('/api/v1/approvals', mockApprovalItems);
  },

  async getAuditEvents(): Promise<{ data: AuditEvent[]; isDemo: boolean }> {
    return fetchJson('/api/v1/activity/audit-logs', mockAuditEvents);
  },

  async getNotifications(): Promise<{ data: Notification[]; isDemo: boolean }> {
    return fetchJson('/api/v1/notifications', mockNotifications);
  },

  async getIntegrations(): Promise<{ data: Integration[]; isDemo: boolean }> {
    return fetchJson('/api/v1/integrations', mockIntegrations);
  },

  async runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    await new Promise((res) => setTimeout(res, 200));

    // Dynamic simulation formula based on resource type
    const baseCost = config.scenarioType === 'resize_ec2' ? 384 : config.scenarioType === 'stop_idle' ? 890 : 640;
    const savingFactor = config.scenarioType === 'stop_idle' ? 1.0 : 0.65;
    const optimizedCost = Math.round(baseCost * (1 - savingFactor));
    const monthlySavings = baseCost - optimizedCost;
    const annualSavings = monthlySavings * 12;

    return {
      currentCost: baseCost,
      optimizedCost,
      monthlySavings,
      annualSavings,
      utilizationImpact: 'Average CPU utilization projected to rise from 6.2% to 34.8% (optimal efficiency band).',
      performanceImpact: 'Zero latency degradation across P95 and P99 metrics.',
      budgetImpact: `Reduces monthly account burn rate by ${(savingFactor * 100).toFixed(1)}%.`,
      roiPercent: Math.round(savingFactor * 100 * 3.4),
      riskScore: config.scenarioType === 'stop_idle' ? 'low' : 'low',
      costComparisonCurve: [
        { month: 'Month 1', baselineCost: baseCost, simulatedCost: optimizedCost },
        { month: 'Month 2', baselineCost: baseCost * 2, simulatedCost: optimizedCost * 2 },
        { month: 'Month 3', baselineCost: baseCost * 3, simulatedCost: optimizedCost * 3 },
        { month: 'Month 6', baselineCost: baseCost * 6, simulatedCost: optimizedCost * 6 },
        { month: 'Month 12', baselineCost: baseCost * 12, simulatedCost: optimizedCost * 12 },
      ],
    };
  },

  async approveRecommendation(recommendationId: string, approverName: string): Promise<{ success: boolean; job: RemediationJob }> {
    await new Promise((res) => setTimeout(res, 150));

    const newJob: RemediationJob = {
      id: `rem_job_${Math.random().toString(36).substring(2, 8)}`,
      recommendationId,
      actionName: 'Execute Boto3 Cloud Remediation Workflow',
      resourceId: 'i-094ab2910c83a71b',
      resourceName: 'payment-processing-worker-04',
      requestedBy: 'FinOps Analyst',
      approvedBy: approverName,
      status: 'completed',
      executionId: `exec_mcp_boto3_${Math.random().toString(36).substring(2, 7)}`,
      startedAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      completedAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      resultSummary: 'Remediation dispatched via MCP server to AWS Boto3 client. Action successfully applied.',
      executionTimeline: [
        { step: 'Recommendation Review', agent: 'Governance Center', timestamp: 'Just now', status: 'success', detail: `Approved by ${approverName}` },
        { step: 'MCP Protocol Payload', agent: 'CloudSense MCP Client', timestamp: 'Just now', status: 'success', detail: 'Dispatched signed MCP command' },
        { step: 'Boto3 SDK Action', agent: 'AWS SDK Boto3 Worker', timestamp: 'Just now', status: 'success', detail: 'Executed AWS modification call' },
        { step: 'Verification', agent: 'Verification Engine', timestamp: 'Just now', status: 'success', detail: 'Resource state validated as Healthy' },
      ],
    };

    return { success: true, job: newJob };
  },

  async rejectRecommendation(recommendationId: string, reason: string): Promise<{ success: boolean }> {
    await new Promise((res) => setTimeout(res, 100));
    console.log(`[CloudSense API] Recommendation ${recommendationId} rejected:`, reason);
    return { success: true };
  },
};
