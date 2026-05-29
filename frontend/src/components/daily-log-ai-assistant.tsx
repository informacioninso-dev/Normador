"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type RecognitionResultEvent = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
    length: number;
  };
};

type RecognitionErrorEvent = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function formatApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "No se pudo registrar la jornada.";
  }

  if ("detail" in payload && typeof payload.detail === "string") {
    return payload.detail;
  }

  const messages = Object.entries(payload)
    .flatMap(([field, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) => `${field}: ${String(item)}`);
      }
      if (typeof value === "string") {
        return [`${field}: ${value}`];
      }
      return [];
    })
    .filter(Boolean);

  return messages[0] ?? "No se pudo registrar la jornada.";
}

export function DailyLogAiAssistant({ projectId }: { projectId: number }) {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supportTitle, setSupportTitle] = useState("");
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportFileName, setSupportFileName] = useState("");

  async function requestMicrophoneAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return true;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  async function startVoiceInput() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setMessage("Tu navegador no soporta dictado. Usa Chrome o Edge.");
      return;
    }

    try {
      await requestMicrophoneAccess();
    } catch {
      setMessage("Permite el microfono en el navegador y vuelve a intentar.");
      return;
    }

    let captured = false;
    let failed = false;
    let pendingTranscript = "";
    let autoStopTimer: number | null = null;
    const appendTranscript = (transcript: string) => {
      setInstruction((current) => [current, transcript].filter(Boolean).join(" "));
    };
    const recognition = new Recognition();
    recognition.lang = "es-ES";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) {
          continue;
        }
        if (result.isFinal) {
          finalTranscript = [finalTranscript, transcript].filter(Boolean).join(" ");
        } else {
          interimTranscript = [interimTranscript, transcript].filter(Boolean).join(" ");
        }
      }

      if (finalTranscript) {
        captured = true;
        pendingTranscript = "";
        appendTranscript(finalTranscript);
        setMessage("Texto capturado.");
      } else if (interimTranscript) {
        captured = true;
        pendingTranscript = interimTranscript;
        setMessage(`Detectando: ${interimTranscript}`);
      }
    };
    recognition.onerror = (event) => {
      failed = true;
      if (autoStopTimer) {
        window.clearTimeout(autoStopTimer);
      }
      const errors: Record<string, string> = {
        "not-allowed": "Permite el microfono en el navegador.",
        "service-not-allowed": "El navegador bloqueo el servicio de dictado.",
        "audio-capture": "No se detecta un microfono disponible.",
        "no-speech": "No detecte voz. Intenta hablar mas cerca del microfono.",
        network: "El servicio de dictado del navegador no respondio.",
      };
      setMessage(errors[event.error] ?? `Error de dictado: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => {
      if (autoStopTimer) {
        window.clearTimeout(autoStopTimer);
      }
      recognitionRef.current = null;
      setListening(false);
      if (pendingTranscript) {
        appendTranscript(pendingTranscript);
        setMessage("Texto capturado.");
        return;
      }
      if (!captured && !failed) {
        setMessage("No se capturo texto. Intenta otra vez.");
      }
    };

    try {
      recognitionRef.current = recognition;
      setMessage("Escuchando. Habla y espera un momento.");
      setListening(true);
      recognition.start();
      autoStopTimer = window.setTimeout(() => recognition.stop(), 15000);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setMessage("No se pudo iniciar el dictado.");
    }
  }

  async function submitInstruction() {
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) {
      setMessage("Escribe o dicta una actividad.");
      return;
    }
    if (saving) {
      return;
    }

    setSaving(true);
    setMessage("Guardando actividad...");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("/api/worklog-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          project: projectId,
          instruction: cleanInstruction,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(formatApiError(payload));
        return;
      }

      const worklogId =
        typeof payload === "object" &&
        payload &&
        "worklog" in payload &&
        typeof payload.worklog === "object" &&
        payload.worklog &&
        "id" in payload.worklog
          ? Number(payload.worklog.id)
          : undefined;

      if (supportFile && worklogId) {
        const evidencePayload = new FormData();
        evidencePayload.set("worklog", String(worklogId));
        evidencePayload.set("file", supportFile);
        if (supportTitle.trim()) {
          evidencePayload.set("title", supportTitle.trim());
        }

        const evidenceResponse = await fetch("/api/worklog-evidence", {
          method: "POST",
          body: evidencePayload,
        });
        const evidenceError = await evidenceResponse.json().catch(() => ({}));
        if (!evidenceResponse.ok) {
          setMessage(`Jornada creada, pero el soporte fallo: ${formatApiError(evidenceError)}`);
          return;
        }
      }

      setInstruction("");
      setSupportTitle("");
      setSupportFile(null);
      setSupportFileName("");
      setOpen(false);
      router.push(`/projects/${projectId}/daily-log?view=bitacora`);
      router.refresh();
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      setMessage(
        isTimeout
          ? "El asistente tardo demasiado. Intenta guardar de nuevo."
          : "No se pudo conectar con el asistente.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print group fixed bottom-5 right-4 z-40 flex items-center gap-3 overflow-hidden rounded-full border border-white/60 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.36),transparent_28%),linear-gradient(135deg,#142052_0%,#4f63d9_48%,#62a9ff_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_22px_60px_rgba(27,37,84,0.38)] ring-4 ring-white/70 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_30px_72px_rgba(27,37,84,0.48)] md:right-5"
      >
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.28)_38%,transparent_64%)] opacity-0 transition duration-500 group-hover:translate-x-10 group-hover:opacity-100" />
        <span className="pointer-events-none absolute -left-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-white/16 blur-2xl" />
        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
          <span className="absolute h-full w-full animate-ping rounded-full bg-sky-200/28" />
          <span className="absolute h-8 w-8 rounded-full bg-[#34266f]/60" />
          <span className="relative text-base tracking-[0.08em]">AI</span>
        </span>
        <span className="relative leading-tight">
          <span className="block text-[10px] uppercase tracking-[0.22em] text-white/72">
            Asistente
          </span>
          <span className="block text-base">Dictar jornada</span>
        </span>
        <span className="relative ml-1 hidden h-8 w-8 place-items-center rounded-full bg-white/14 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.26)] sm:grid">
          <span className="h-3 w-3 rounded-full border-2 border-current border-l-transparent" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-ink/18 p-4 backdrop-blur-sm md:p-6">
          <div className="w-full max-w-md rounded-[22px] border border-black/8 bg-white p-4 shadow-[0_24px_70px_rgba(27,37,84,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                  Registro diario
                </p>
                <h2 className="mt-1 text-xl font-bold text-ink">Asistente AI</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-black/8 bg-white px-3 py-1 text-sm font-semibold text-ink hover:bg-sand"
              >
                Cerrar
              </button>
            </div>

            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              className="mt-4 min-h-[150px]"
              placeholder="Capacitacion con el titulo POE del proceso 4 desde las 8 am hasta las 9"
            />

            <div className="mt-3 rounded-[18px] bg-sand/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Soporte opcional
              </p>
              <div className="mt-3 grid gap-2">
                <input
                  value={supportTitle}
                  onChange={(event) => setSupportTitle(event.target.value)}
                  placeholder="Titulo del soporte"
                />
                <label className="grid cursor-pointer rounded-[16px] border border-signal/16 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#edf3ff]">
                  Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSupportFile(file);
                      setSupportFileName(file?.name ?? "");
                    }}
                  />
                </label>
                <label className="grid cursor-pointer rounded-[16px] border border-signal/16 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#edf3ff]">
                  Subir archivo
                  <input
                    type="file"
                    accept="image/*,.pdf,.docx,.xlsx,.txt"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSupportFile(file);
                      setSupportFileName(file?.name ?? "");
                    }}
                  />
                </label>
              </div>
              {supportFileName ? (
                <p className="mt-2 truncate text-xs font-semibold text-ink/58">
                  Seleccionado: {supportFileName}
                </p>
              ) : null}
            </div>

            {message ? <p className="mt-3 text-sm text-signal">{message}</p> : null}

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={listening ? stopVoiceInput : startVoiceInput}
                disabled={saving}
                className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand disabled:opacity-60"
              >
                {listening ? "Detener" : "Dictar"}
              </button>
              <button
                type="button"
                onClick={submitInstruction}
                disabled={saving}
                className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar actividad"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
