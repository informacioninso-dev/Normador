from django.test import TestCase


class HealthcheckTests(TestCase):
    def test_healthcheck_returns_detailed_status(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn(payload["status"], {"ok", "degraded"})
        self.assertEqual(payload["service"], "audibot-backend")
        self.assertEqual(payload["checks"]["database"]["status"], "ok")
        self.assertEqual(payload["checks"]["media_root"]["status"], "ok")
        self.assertEqual(payload["checks"]["ai_provider"]["status"], "configured")
