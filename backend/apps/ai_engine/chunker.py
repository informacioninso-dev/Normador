import re
from dataclasses import dataclass
from typing import List

from django.conf import settings


WORD_PATTERN = re.compile(r"\S+")


@dataclass
class ChunkPayload:
    chunk_index: int
    content: str
    word_count: int
    character_start: int
    character_end: int
    metadata: dict


def chunk_text(
    text: str,
    *,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> List[ChunkPayload]:
    normalized = (text or "").strip()
    if not normalized:
        return []

    chunk_size = max(chunk_size or settings.CHUNK_SIZE_WORDS, 1)
    overlap = max(min(overlap or settings.CHUNK_OVERLAP_WORDS, chunk_size - 1), 0)
    step = max(chunk_size - overlap, 1)

    word_matches = list(WORD_PATTERN.finditer(normalized))
    if not word_matches:
        return []

    chunks: List[ChunkPayload] = []
    for chunk_index, start_index in enumerate(range(0, len(word_matches), step)):
        end_index = min(start_index + chunk_size, len(word_matches))
        first_match = word_matches[start_index]
        last_match = word_matches[end_index - 1]
        content = normalized[first_match.start() : last_match.end()].strip()
        if not content:
            continue

        chunks.append(
            ChunkPayload(
                chunk_index=chunk_index,
                content=content,
                word_count=end_index - start_index,
                character_start=first_match.start(),
                character_end=last_match.end(),
                metadata={
                    "token_start": start_index,
                    "token_end": end_index - 1,
                    "overlap_words": overlap,
                },
            )
        )

        if end_index >= len(word_matches):
            break

    return chunks
