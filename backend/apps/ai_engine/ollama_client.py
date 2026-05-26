import json
import urllib.error
import urllib.request

from django.conf import settings


class OllamaAPIError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, base_url: str | None = None, timeout_seconds: int | None = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds or settings.AI_REQUEST_TIMEOUT_SECONDS

    def embed(
        self,
        *,
        model: str,
        inputs: list[str],
        truncate: bool = True,
        dimensions: int | None = None,
    ) -> dict:
        payload = {
            "model": model,
            "input": inputs,
            "truncate": truncate,
        }
        if dimensions is not None:
            payload["dimensions"] = dimensions

        request = urllib.request.Request(
            url=f"{self.base_url}/api/embed",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw_body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise OllamaAPIError(f"Ollama HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise OllamaAPIError(f"Ollama connection error: {exc.reason}") from exc

        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise OllamaAPIError("Ollama returned invalid JSON") from exc

        embeddings = data.get("embeddings")
        if not isinstance(embeddings, list):
            raise OllamaAPIError("Ollama response did not include embeddings")

        return data

    def chat_structured(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        schema: dict,
        temperature: float = 0,
    ) -> dict:
        payload = {
            "model": model,
            "stream": False,
            "format": schema,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": temperature,
            },
        }

        request = urllib.request.Request(
            url=f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw_body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise OllamaAPIError(f"Ollama HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise OllamaAPIError(f"Ollama connection error: {exc.reason}") from exc

        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise OllamaAPIError("Ollama returned invalid JSON") from exc

        content = (
            data.get("message", {}).get("content")
            if isinstance(data.get("message"), dict)
            else None
        )
        if not isinstance(content, str) or not content.strip():
            raise OllamaAPIError("Ollama response did not include structured message content")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise OllamaAPIError("Ollama structured response was not valid JSON") from exc

        return {
            "parsed": parsed,
            "raw": data,
        }
