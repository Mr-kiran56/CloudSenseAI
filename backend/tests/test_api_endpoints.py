import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

import unittest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.init_db import init_db


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.client = TestClient(app)
        # Authenticate with seeded admin user
        login_res = self.client.post(
            "/api/v1/auth/login",
            json={"email": "kiranpunna58@gmail.com", "password": "KIRAN5656@"}
        )
        self.assertEqual(login_res.status_code, 200, f"Login failed: {login_res.text}")
        token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {token}"}

    def test_auth_me(self):
        res = self.client.get("/api/v1/auth/me", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["email"], "kiranpunna58@gmail.com")
        self.assertEqual(data["role"], "admin")

    def test_cloud_accounts(self):
        res = self.client.get("/api/v1/cloud-accounts", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        account_ids = [a["accountId"] for a in data]
        self.assertIn("synthesis-demo", account_ids)
        self.assertIn("658606186069", account_ids)

    def test_dashboard_summary(self):
        res = self.client.get("/api/v1/dashboard/summary?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("totalSpend", data)
        self.assertIn("forecastSpend", data)
        self.assertIn("potentialSavings", data)
        self.assertGreater(data["totalSpend"], 0)

    def test_resources_endpoint(self):
        res = self.client.get("/api/v1/resources?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_recommendations_endpoint(self):
        res = self.client.get("/api/v1/recommendations?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_approvals_endpoint(self):
        res = self.client.get("/api/v1/approvals?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_cost_forecast_endpoint(self):
        res = self.client.get("/api/v1/cost/forecast?horizon_days=14&account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_cost_breakdown_endpoint(self):
        res = self.client.get("/api/v1/cost/breakdown?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_unit_economics_endpoint(self):
        res = self.client.get("/api/v1/unit-economics?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        self.assertIn("shapFeatures", data[0])

    def test_integrations_endpoint(self):
        res = self.client.get("/api/v1/integrations", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)

    def test_chat_query_endpoint(self):
        res = self.client.post(
            "/api/v1/chat/query",
            json={"message": "What is our 30-day Prophet forecast?"},
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("response", data)
        self.assertIn("citations", data)
        self.assertIn("actionsAvailable", data)

    def test_chat_config_endpoints(self):
        # GET config
        res_get = self.client.get("/api/v1/chat/config", headers=self.headers)
        self.assertEqual(res_get.status_code, 200)
        data_get = res_get.json()
        self.assertIn("provider", data_get)
        self.assertIn("model", data_get)

        # POST config
        res_post = self.client.post(
            "/api/v1/chat/config",
            json={"provider": "gemini", "model": "gemini-2.5-flash", "api_key": "mock-gemini-test-key-123"},
            headers=self.headers
        )
        self.assertEqual(res_post.status_code, 200)
        data_post = res_post.json()
        self.assertTrue(data_post.get("success"))
        self.assertTrue(data_post.get("is_configured"))

        # Reset config to clean state for subsequent queries
        self.client.post(
            "/api/v1/chat/config",
            json={"provider": "gemini", "model": "gemini-2.5-flash", "api_key": ""},
            headers=self.headers
        )

    def test_synthesis_summary_endpoint(self):
        res = self.client.get("/api/v1/synthesis/summary", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ready")
        self.assertIn("modelsDeployed", data)

    def test_notifications_endpoints(self):
        res = self.client.get("/api/v1/notifications?account_id=synthesis-demo", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

        # Mark all read
        res_mark = self.client.post("/api/v1/notifications/mark-all-read", headers=self.headers)
        self.assertEqual(res_mark.status_code, 200)
        self.assertTrue(res_mark.json().get("success"))

    def test_dow_simulation_and_mitigation(self):
        # 1. Trigger DoW attack simulation
        res_sim = self.client.post(
            "/api/v1/synthesis/simulate-dow-attack",
            json={"attack_intensity": 2.0},
            headers=self.headers
        )
        self.assertEqual(res_sim.status_code, 200)
        data_sim = res_sim.json()
        self.assertIn("incident_id", data_sim)
        self.assertIn("model_c_inference", data_sim)
        self.assertTrue(data_sim.get("persisted_to_db"))

        inc_id = data_sim["incident_id"]

        # 2. Deploy WAF Mitigation via MCP
        res_mit = self.client.post(
            f"/api/v1/anomalies/{inc_id}/mitigate",
            json={"action_type": "deploy_waf_rate_limit"},
            headers=self.headers
        )
        self.assertEqual(res_mit.status_code, 200)
        data_mit = res_mit.json()
        self.assertTrue(data_mit.get("success"))
        self.assertEqual(data_mit.get("incidentStatus"), "mitigated")


if __name__ == "__main__":
    unittest.main()
