import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AuthGate } from './components/layout/AuthGate';
import { PublicShell } from './components/layout/PublicShell';

import { LandingPage } from './pages/public/LandingPage';
import { ArchitecturePage } from './pages/public/ArchitecturePage';
import { ResearchPage } from './pages/public/ResearchPage';
import { DocsPage } from './pages/public/DocsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { WelcomePage } from './pages/auth/WelcomePage';

import { Dashboard } from './pages/Dashboard';
import { CostForecastPage } from './pages/CostForecastPage';
import { UnitEconomicsPage } from './pages/UnitEconomicsPage';
import { ResourceExplorerPage } from './pages/ResourceExplorerPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { RecommendationDetailPage } from './pages/RecommendationDetailPage';
import { AnomaliesDoWPage } from './pages/AnomaliesDoWPage';
import { RemediationCenterPage } from './pages/RemediationCenterPage';
import { WhatIfSimulatorPage } from './pages/WhatIfSimulatorPage';
import { AssistantPage } from './pages/AssistantPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { CloudAccountsPage } from './pages/CloudAccountsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ActivityAuditPage } from './pages/ActivityAuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpDocsPage } from './pages/HelpDocsPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { SoftWashBackdrop } from './components/visual/SoftWashBackdrop';
import { DesktopOnlyNotice } from './components/layout/DesktopOnlyNotice';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/product" element={<LandingPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/docs" element={<DocsPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/welcome"
        element={
          <AuthGate>
            <WelcomePage />
          </AuthGate>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cost"
        element={
          <ProtectedRoute>
            <CostForecastPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/unit-economics"
        element={
          <ProtectedRoute>
            <UnitEconomicsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resources"
        element={
          <ProtectedRoute>
            <ResourceExplorerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recommendations"
        element={
          <ProtectedRoute>
            <RecommendationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recommendations/:id"
        element={
          <ProtectedRoute>
            <RecommendationDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/anomalies"
        element={
          <ProtectedRoute>
            <AnomaliesDoWPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/anomalies/:id"
        element={
          <ProtectedRoute>
            <AnomaliesDoWPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/remediation"
        element={
          <ProtectedRoute>
            <RemediationCenterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/remediation/:id"
        element={
          <ProtectedRoute>
            <RemediationCenterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulator"
        element={
          <ProtectedRoute>
            <WhatIfSimulatorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assistant"
        element={
          <ProtectedRoute>
            <AssistantPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cloud-accounts"
        element={
          <ProtectedRoute>
            <CloudAccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/policies"
        element={
          <ProtectedRoute>
            <PoliciesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity"
        element={
          <ProtectedRoute>
            <ActivityAuditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/*"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpDocsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <SoftWashBackdrop />
          <DesktopOnlyNotice />
          <div className="relative z-[1] min-h-full">
            <AppRoutes />
          </div>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
