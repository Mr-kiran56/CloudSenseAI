# CloudSense AI Backend & Machine Learning Engine

A production-grade cloud financial intelligence, predictive machine learning, and Model Context Protocol (MCP) safe remediation platform built with **FastAPI**, **SQLAlchemy**, **Prophet**, **XGBoost**, **Isolation Forest**, and **Boto3**.

---

## 🏛️ System Architecture Flow

The backend follows the 7-stage processing pipeline defined in `Architectuer_Flow.png` and `# CloudSense AI - Complete Implementation Roadmap`:

1. **AWS Cloud Telemetry Layer:** Ingestion of AWS CUR 2.0 daily billing, 5-minute CloudWatch infrastructure metrics (CPU, Memory, Network I/O, Concurrency), and business KPI telemetry.
2. **Data Ingestion & Feature Engineering:** Automated collectors with timestamp normalization to UTC, rolling-window calculations (CostVelocity, ProvisioningFrequency).
3. **Parallel ML Models Layer:**
   - **Model A (Prophet):** Cloud cost forecasting across 7, 30, and 90-day horizons with 80% prediction intervals and budget overrun date detection (`P3_tuned` variant).
   - **Model B (XGBoost):** Unit economics prediction (cost per 1k API requests, cost per user, cost per transaction) powered by 144 boosted trees and native TreeSHAP explainability.
   - **Model C (Isolation Forest):** 5-minute streaming outlier detection with calibrated threshold (11.2454) and real-time triage between Denial-of-Wallet (DoW) attacks, benign flash crowds, and operational anomalies.
4. **XAI & FinOps Recommendation Engine:** Feature attribution combined with mathematical FinOps calculations (idle capacity, rightsizing, unattached EBS purge, savings plans) with uncertainty bands, checks, and ROI.
5. **Human Approval & Policy Guardrails:** Mandatory human sign-off for state-changing cloud modifications with cryptographic action hashes and allowlist verification.
6. **MCP Server & Boto3 Execution Layer:** Model Context Protocol tools enforcing least-privilege IAM credentials, pre-flight dry runs, rollback tokens, and CloudTrail audit logging.
7. **React SaaS Console & FinOps Copilot:** High-density live telemetry views, interactive what-if simulator, conversational AI copilot, and Data & Model Verification Lab.

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.10+
- Virtualenv or system Python with packages in `requirements.txt`

### 2. Run the Backend
From the repository root:
```bash
# Using npm script:
npm run backend

# Or directly with Python:
python backend/run.py
```

The server starts at `http://localhost:8000`.
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Redoc Documentation: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/api/v1/health`

### 3. Run the Frontend
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🔐 Default Demo Accounts (Pre-seeded)

| Role | Email | Password | Permissions |
|---|---|---|---|
| **FinOps Administrator** | `admin@cloudsense.ai` | `Admin@123456` | Full approval, policy editing & remediation |
| **Senior FinOps Analyst** | `analyst@cloudsense.ai` | `Analyst@123456` | Forecast review, SHAP analysis & approvals |
| **DevOps Cloud Engineer** | `engineer@cloudsense.ai` | `Engineer@123456` | Resource telemetry & sandbox remediation |

---

## 📡 Core API Routes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate user & issue JWT bearer token |
| `POST` | `/api/v1/auth/register` | Register new FinOps user with role |
| `GET` | `/api/v1/auth/me` | Retrieve profile of authenticated user |
| `GET` | `/api/v1/dashboard/summary` | Real-time spend, burn rate, efficiency score, and counts |
| `GET` | `/api/v1/cost/forecast` | Live Prophet Model A inference (7/30/90 days + intervals) |
| `GET` | `/api/v1/cost/breakdown` | Service-level expenditure breakdown |
| `GET` | `/api/v1/unit-economics` | Live XGBoost Model B unit costs + TreeSHAP feature forces |
| `GET` | `/api/v1/anomalies` | Incident feed triaged by Isolation Forest Model C |
| `POST` | `/api/v1/anomalies/detect` | Score arbitrary 5-minute telemetry window in real time |
| `GET` | `/api/v1/resources` | AWS cloud resource inventory with utilization metrics |
| `GET` | `/api/v1/recommendations` | FinOps optimization recommendations with validated ROI |
| `GET` | `/api/v1/approvals` | Human approval queue for state-changing cloud actions |
| `POST` | `/api/v1/approvals/{id}/decision` | Cryptographically sign approval or reject recommendation |
| `GET` | `/api/v1/remediation/jobs` | MCP Boto3 execution logs & status history |
| `POST` | `/api/v1/remediation/jobs/{id}/rollback` | Revert cloud state using rollback token |
| `POST` | `/api/v1/simulations/run` | What-if cost simulator with multi-month projection curve |
| `POST` | `/api/v1/chat/query` | Conversational FinOps Assistant agent with tool calls |
| `GET` | `/api/v1/synthesis/summary` | Raw synthesis datasets registry (9 datasets ingested) |
| `GET` | `/api/v1/synthesis/dataset/{name}` | Paginated raw dataset inspection preview |
| `GET` | `/api/v1/synthesis/model-evaluation` | Comprehensive cross-validation & benchmark metrics |
| `POST` | `/api/v1/synthesis/simulate-dow-attack` | Stream synthetic Denial-of-Wallet attack window |
