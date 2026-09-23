export type UserRole = 'admin' | 'finops_analyst' | 'cloud_engineer' | 'viewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  title: string;
  department: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    density: 'comfortable' | 'compact';
    defaultAccountId: string;
    defaultRegion: string;
    defaultDateRange: string;
  };
}

export interface AWSAccount {
  id: string;
  accountId: string;
  name: string;
  alias: string;
  env: 'production' | 'staging' | 'dev' | 'qa';
  region: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  lastSync: string;
  resourceCount: number;
  monthlySpend: number;
}

export interface DashboardSummary {
  totalSpend: number;
  forecastSpend: number;
  potentialSavings: number;
  activeAnomaliesCount: number;
  pendingApprovalsCount: number;
  healthyResourceCount: number;
  underutilizedResourceCount: number;
  oversizedResourceCount: number;
  idleResourceCount: number;
  criticalResourceCount: number;
  spendTrendPercent: number;
  aiInsight: string;
}

export interface CostForecastPoint {
  date: string;
  actualCost: number | null;
  forecastCost: number;
  confidenceUpper: number;
  confidenceLower: number;
  budgetLimit: number;
}

export interface CostBreakdownItem {
  category: string;
  name: string;
  cost: number;
  changePercent: number;
  percentage: number;
}

export interface ShapFeature {
  feature: string;
  impact: number; // positive or negative influence score
  description: string;
}

export interface UnitEconomicsMetric {
  id: string;
  name: string;
  unitLabel: string;
  currentUnitCost: number;
  predictedUnitCost: number;
  kpiVolume: number;
  costGrowthPercent: number;
  kpiGrowthPercent: number;
  efficiencyRatio: number;
  shapFeatures: ShapFeature[];
}

export type ResourceService = 'EC2' | 'EBS' | 'RDS' | 'Lambda' | 'S3' | 'AutoScaling' | 'ElastiCache' | 'NATGateway';
export type ResourceStatus = 'healthy' | 'underutilized' | 'oversized' | 'idle' | 'critical';

export interface CloudResource {
  id: string;
  resourceId: string;
  name: string;
  service: ResourceService;
  region: string;
  environment: string;
  status: ResourceStatus;
  cpuUtilization: number;
  memoryUtilization: number;
  networkIOMbs: number;
  monthlyCost: number;
  estimatedSaving: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastSeen: string;
  tags: Record<string, string>;
  metricsHistory: { timestamp: string; cpu: number; memory: number; cost: number }[];
}

export interface RecommendationEvidence {
  metric: string;
  value: string;
  baseline: string;
}

export interface Recommendation {
  id: string;
  title: string;
  resourceId: string;
  resourceName: string;
  service: ResourceService;
  region?: string;
  problem: string;
  rootCause: string;
  aiConfidence: number; // e.g. 0.94 -> 94%
  risk: 'low' | 'medium' | 'high' | 'critical';
  monthlySavings: number;
  annualSavings: number;
  businessImpact: string;
  performanceImpact: string;
  recommendedAction: string;
  rollbackAction: string;
  status: 'needs_review' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
  createdAt: string;
  shapFeatures: ShapFeature[];
  evidence: RecommendationEvidence[];
}

export interface AnomalyTimelineItem {
  step: string;
  timestamp: string;
  status: 'completed' | 'current' | 'pending';
  description: string;
}

export interface Anomaly {
  id: string;
  type: 'cost_anomaly' | 'denial_of_wallet';
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  resourceId: string;
  resourceName: string;
  service: ResourceService;
  region: string;
  costVelocity: string;
  requestRateChange: string;
  provisioningSpike: string;
  detectedAt: string;
  status: 'detected' | 'investigating' | 'mitigating' | 'resolved';
  evidence: string[];
  attackTimeline: AnomalyTimelineItem[];
}

export interface RemediationTimelineItem {
  step: string;
  agent: string;
  timestamp: string;
  status: 'success' | 'running' | 'pending' | 'failed';
  detail: string;
}

export interface RemediationJob {
  id: string;
  recommendationId: string;
  actionName: string;
  resourceId: string;
  resourceName: string;
  requestedBy: string;
  approvedBy: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  executionId: string;
  startedAt: string;
  completedAt?: string;
  resultSummary: string;
  executionTimeline: RemediationTimelineItem[];
}

export interface SimulationConfig {
  scenarioType: 'resize_ec2' | 'stop_idle' | 'gp2_to_gp3' | 'rds_rightsizing' | 'autoscale_policy';
  resourceId: string;
  currentConfig: string;
  proposedConfig: string;
  workloadPattern: 'steady' | 'spiky' | 'growing';
  timeHorizonMonths: number;
}

export interface SimulationResult {
  currentCost: number;
  optimizedCost: number;
  monthlySavings: number;
  annualSavings: number;
  utilizationImpact: string;
  performanceImpact: string;
  budgetImpact: string;
  roiPercent: number;
  riskScore: 'low' | 'medium' | 'high';
  costComparisonCurve: { month: string; baselineCost: number; simulatedCost: number }[];
}

export interface ApprovalItem {
  id: string;
  recommendationId: string;
  title: string;
  resourceId: string;
  resourceName: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  estimatedSavings: number;
  requester: string;
  requestedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  evidenceSummary: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  resourceId: string;
  environment: string;
  result: 'success' | 'failure' | 'warning';
  correlationId: string;
  details: string;
}

export interface Notification {
  id: string;
  type: 'cost' | 'dow' | 'approval' | 'remediation' | 'forecast' | 'system';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  read: boolean;
  relatedResourceId?: string;
  link?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: 'slack' | 'teams' | 'discord' | 'email' | 'webhook' | 'pagerduty';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  iconName: string;
  description: string;
  lastEventAt: string;
  webhookUrl?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolCalls?: { tool: string; args: string; status: 'completed' | 'pending' }[];
  citations?: { label: string; link: string }[];
  approvalTrigger?: Recommendation;
}
