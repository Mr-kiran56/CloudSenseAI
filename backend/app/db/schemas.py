from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "cloud_engineer"
    # Optional initial AWS Cloud Account Connection during sign up
    aws_account_id: Optional[str] = None
    aws_account_name: Optional[str] = None
    aws_role_arn: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_external_id: Optional[str] = None
    aws_region: Optional[str] = "us-east-1"
    aws_env: Optional[str] = "production"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Account Schemas ---
class AWSAccountSchema(BaseModel):
    id: int
    account_id: str
    name: str
    alias: Optional[str] = None
    env: Optional[str] = "production"
    region: str
    role_arn: Optional[str] = None
    status: str
    monthly_spend: float
    resource_count: Optional[int] = 0
    is_demo: Optional[bool] = False
    last_synced: datetime

    class Config:
        from_attributes = True

class AWSAccountCreate(BaseModel):
    account_id: str
    name: str
    alias: Optional[str] = None
    env: Optional[str] = "production"
    region: Optional[str] = "us-east-1"
    role_arn: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    external_id: Optional[str] = None
    test_connection: Optional[bool] = True

class AWSAccountTestRequest(BaseModel):
    region: Optional[str] = "us-east-1"
    role_arn: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    external_id: Optional[str] = None

# --- Cost & Forecast Schemas ---
class CostBreakdownItem(BaseModel):
    name: Optional[str] = None
    service: str
    category: Optional[str] = "Compute"
    cost: float
    percentage: float
    trend: Optional[str] = "flat"
    changePercent: float

class DailyCostPoint(BaseModel):
    date: str
    cost: float
    service: Optional[str] = None

class CostForecastPoint(BaseModel):
    date: str
    actual: Optional[float] = None
    predicted: float
    lowerBound: float
    upperBound: float
    isAnomaly: Optional[bool] = False

class BudgetOverrunInfo(BaseModel):
    monthly_budget: float
    current_burn: float
    overrun_predicted: bool
    overrun_date: Optional[str] = None
    projected_end_of_month: float

# --- Unit Economics Schemas ---
class SHAPDriver(BaseModel):
    feature: str
    family: str
    shap_change: float
    direction: str  # raises / lowers
    value: Optional[float] = None

class UnitEconomicsMetric(BaseModel):
    id: str
    name: str
    unit: str
    currentCost: float
    previousCost: float
    changePercent: float
    status: str  # optimal, elevated, critical
    drivers: List[str]
    history: List[Dict[str, Any]]
    recommendedAction: str
    riskLevel: str
    shapDrivers: Optional[List[SHAPDriver]] = None

# --- Resource Schemas ---
class CloudResourceSchema(BaseModel):
    id: str
    name: str
    type: str
    region: str
    service: str
    status: str
    monthlyCost: float
    tags: Dict[str, str]
    metrics: Dict[str, Any]
    launchTime: str
    account_id: Optional[str] = "123456789012"

# --- Anomaly & DoW Schemas ---
class AnomalyItem(BaseModel):
    id: str
    service: str
    resourceId: Optional[str] = None
    severity: str
    detectedAt: str
    status: str
    costSpikePercent: float
    estimatedImpactUsd: float
    anomalyScore: float
    rootCause: str
    recommendedAction: str
    triageClass: str  # dow_candidate, benign_spike, operational_anomaly
    features: Optional[Dict[str, float]] = None

# --- Recommendations & Approvals ---
class RecommendationSchema(BaseModel):
    id: str
    title: str
    description: str
    category: str
    service: str
    resourceId: str
    estimatedMonthlySavings: float
    estimatedSavingsLow: float
    estimatedSavingsHigh: float
    currentMonthlyCost: float
    risk: str
    confidenceScore: float
    actionType: str
    status: str
    implementationEffort: str
    roiPercent: float
    policyChecks: List[Dict[str, Any]]

class ApprovalDecisionRequest(BaseModel):
    decision: str  # approved, rejected
    notes: Optional[str] = None
    approverName: Optional[str] = "FinOps Lead"

class RemediationJobSchema(BaseModel):
    id: str
    recommendationId: str
    actionType: str
    resourceId: str
    status: str
    initiatedBy: str
    initiatedAt: str
    completedAt: Optional[str] = None
    dryRun: bool
    rollbackAvailable: bool
    executionLog: List[str]

# --- What-If Simulation ---
class SimulationConfigRequest(BaseModel):
    scenarioType: str
    targetResource: str
    currentInstanceType: Optional[str] = None
    targetInstanceType: Optional[str] = None
    region: Optional[str] = "us-east-1"
    workloadHoursPerMonth: Optional[float] = 730.0
    discountPercent: Optional[float] = 0.0

class SimulationResponse(BaseModel):
    currentCost: float
    optimizedCost: float
    monthlySavings: float
    annualSavings: float
    utilizationImpact: str
    performanceImpact: str
    budgetImpact: str
    roiPercent: float
    riskScore: str
    costComparisonCurve: List[Dict[str, Any]]

# --- Dashboard Summary ---
class DashboardSummary(BaseModel):
    totalSpend: Optional[float] = None
    totalMonthlySpend: float
    forecastSpend: Optional[float] = None
    projectedMonthEnd: float
    budgetMonthly: float
    potentialSavings: Optional[float] = None
    savingsIdentified: float
    savingsRealized: float
    activeAnomaliesCount: int
    pendingApprovalsCount: int
    monitoredResourcesCount: int
    healthyResourceCount: Optional[int] = 32
    underutilizedResourceCount: Optional[int] = 3
    oversizedResourceCount: Optional[int] = 2
    idleResourceCount: Optional[int] = 1
    criticalResourceCount: Optional[int] = 1
    spendTrendPercent: Optional[float] = 4.2
    finopsEfficiencyScore: int
    aiInsight: Optional[str] = None
    currency: str = "USD"
    lastUpdated: str

# --- Audit, Notifications, Integrations ---
class AuditEventSchema(BaseModel):
    id: str
    timestamp: str
    actor: str
    action: str
    target: str
    targetType: str
    status: str
    details: Dict[str, Any]

class NotificationSchema(BaseModel):
    id: str
    title: str
    message: str
    severity: str
    category: str
    timestamp: str
    read: bool
    link: Optional[str] = None

class IntegrationSchema(BaseModel):
    id: str
    name: str
    type: str
    status: str
    connectedAt: str
    eventsForwarded: int

# --- Chat Assistant ---
class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str
    timestamp: Optional[str] = None

class ChatQueryRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

class ChatQueryResponse(BaseModel):
    response: str
    citations: Optional[List[str]] = None
    actionsAvailable: Optional[List[Dict[str, Any]]] = None
    dataContext: Optional[Dict[str, Any]] = None
