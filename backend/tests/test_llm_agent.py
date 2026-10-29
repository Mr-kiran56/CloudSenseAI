import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

import unittest
from backend.app.agents.llm_agent import FinOpsLLMAgent, llm_agent

class TestLLMAgentEngine(unittest.TestCase):
    def setUp(self):
        self.engine = FinOpsLLMAgent()
        self.engine.save_configured_llm(provider="gemini", model="gemini-1.5-flash", api_key="")

    def tearDown(self):
        self.engine.save_configured_llm(provider="gemini", model="gemini-1.5-flash", api_key="")

    def test_default_configuration(self):
        cfg = self.engine.get_configured_llm()
        self.assertIn("provider", cfg)
        self.assertIn("model", cfg)
        self.assertIn("is_configured", cfg)

    def test_system_prompt_generation(self):
        ctx = self.engine.assemble_finops_context(account_id="synthesis-demo")
        prompt = self.engine.generate_system_prompt(ctx)
        self.assertIn("CloudSense AI", prompt)
        self.assertIn("Prophet", prompt)
        self.assertIn("Model C", prompt)
        self.assertIn("FinOps", prompt)

    def test_rag_fallback_query(self):
        # Querying without an external API key runs the local FinOps heuristic & RAG engine
        res = self.engine.process_query(
            query="What is our projected cost and are there any active DoW threats?",
            account_id="synthesis-demo"
        )
        self.assertIn("response", res)
        self.assertIn("citations", res)
        self.assertIn("actionsAvailable", res)
        self.assertIn("llm_used", res)
        self.assertGreater(len(res["response"]), 50)

    def test_update_config(self):
        res = self.engine.save_configured_llm(
            provider="openai",
            model="gpt-4o",
            api_key="sk-testmock123"
        )
        self.assertTrue(res.get("success"))
        self.assertTrue(res.get("is_configured"))

        # Reset back to clean state
        self.engine.save_configured_llm(provider="gemini", model="gemini-1.5-flash", api_key="")
        cfg = self.engine.get_configured_llm()
        self.assertFalse(cfg.get("is_configured"))

if __name__ == "__main__":
    unittest.main()
