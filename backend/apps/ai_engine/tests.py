from django.test import SimpleTestCase

from apps.ai_engine.chunker import chunk_text


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
