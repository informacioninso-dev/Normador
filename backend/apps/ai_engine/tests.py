from django.test import SimpleTestCase

from apps.ai_engine.chunker import chunk_text
from apps.ai_engine.ollama_client import OllamaClient, OllamaAPIError
from unittest.mock import patch


class ChunkerTests(SimpleTestCase):
    def test_chunk_text_applies_overlap(self):
        text = (
            "uno dos tres cuatro cinco seis siete ocho nueve diez "
            "once doce trece catorce quince"
        )

        chunks = chunk_text(text, chunk_size=5, overlap=2)

        self.assertEqual(len(chunks), 5)
        self.assertEqual(chunks[0].word_count, 5)
        self.assertTrue(chunks[0].content.startswith("uno dos tres"))
        self.assertTrue(chunks[1].content.startswith("cuatro cinco seis"))
        self.assertEqual(chunks[1].metadata["overlap_words"], 2)


class OllamaErrorTests(SimpleTestCase):
    def test_timeouts_are_reported_as_provider_errors(self):
        client = OllamaClient()
        operations = [
            lambda: client.embed(model="test", inputs=["test"]),
            lambda: client.chat_structured(model="test", system_prompt="test", user_prompt="test", schema={}),
        ]
        for operation in operations:
            with self.subTest(operation=operation), patch("urllib.request.urlopen", side_effect=TimeoutError):
                with self.assertRaises(OllamaAPIError):
                    operation()
