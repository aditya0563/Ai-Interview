"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VisualizerState = "idle" | "requesting" | "active" | "error";

interface AudioVisualizerProps {
  /** Called with the latest committed (final) transcript text each time speech
   *  is finalised, and also with the current interim text as the user speaks. */
  onTranscript?: (text: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FFT_SIZE = 256; // power of 2; gives 128 frequency bins
const BAR_GAP = 2; // px gap between bars
const MIN_BAR_HEIGHT = 3; // quiet-bin floor (px)
const GRADIENT_TOP = "rgba(139, 92, 246, 0.9)"; // violet-500
const GRADIENT_BTM = "rgba(99, 102, 241, 0.6)"; // indigo-500
const GLOW_COLOR = "rgba(167, 139, 250, 0.35)"; // violet-400

// ─── Helpers (pure, defined outside the component) ───────────────────────────

function renderIdleBars(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const barCount = 64;
  const totalGap = BAR_GAP * (barCount - 1);
  const barWidth = Math.max(1, (width - totalGap) / barCount);

  for (let i = 0; i < barCount; i++) {
    const t = i / barCount;
    const sinVal = Math.sin(t * Math.PI * 4) * 0.15 + 0.15;
    const barHeight = Math.max(MIN_BAR_HEIGHT, sinVal * height);
    const x = i * (barWidth + BAR_GAP);
    const y = height - barHeight;

    ctx.fillStyle = "rgba(139, 92, 246, 0.18)";
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
    ctx.fill();
  }
}

function renderFrequencyBars(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const barCount = dataArray.length;
  const totalGap = BAR_GAP * (barCount - 1);
  const barWidth = Math.max(1, (width - totalGap) / barCount);

  for (let i = 0; i < barCount; i++) {
    const normalised = dataArray[i]! / 255;
    const barHeight = Math.max(MIN_BAR_HEIGHT, normalised * height * 0.92);
    const x = i * (barWidth + BAR_GAP);
    const y = height - barHeight;

    const grad = ctx.createLinearGradient(x, y, x, height);
    grad.addColorStop(0, GRADIENT_TOP);
    grad.addColorStop(1, GRADIENT_BTM);

    ctx.shadowBlur = normalised > 0.5 ? 12 * normalised : 0;
    ctx.shadowColor = GLOW_COLOR;

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
    ctx.fill();
  }
}

/** Returns the browser's SpeechRecognition constructor, or null if unsupported. */
function getSpeechRecognitionCtor():
  | typeof SpeechRecognition
  | null {
  if (typeof window === "undefined") return null;
  // Standard or webkit-prefixed
  return (
    (window.SpeechRecognition ?? window.webkitSpeechRecognition) ?? null
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AudioVisualizer({ onTranscript }: AudioVisualizerProps) {
  const [state, setState] = useState<VisualizerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const [speechSupported] = useState<boolean>(() => getSpeechRecognitionCtor() !== null);

  // All Web Audio objects live in refs — mutations never trigger renders.
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Speech recognition ref — kept out of state so mutations are synchronous.
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Keep a stable ref to the latest onTranscript callback so the recognition
  // event handler never goes stale without needing to be restarted.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // ── rAF drawing loop ─────────────────────────────────────────────────────────
  // All captured values are stable refs — deps array can safely be empty.

  const startDrawLoop = useCallback(() => {
    function loop() {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;
      renderFrequencyBars(canvas, analyser);
      rafIdRef.current = requestAnimationFrame(loop);
    }
    rafIdRef.current = requestAnimationFrame(loop);
  }, []); // deps empty — only touches stable refs

  // ── Canvas DPI scaling + idle render ─────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function applyDPR() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio ?? 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx?.scale(dpr, dpr);
    }

    applyDPR();
    renderIdleBars(canvas);

    const ro = new ResizeObserver(() => {
      applyDPR();
      if (!analyserRef.current) renderIdleBars(canvas);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []); // intentionally empty — refs never change identity

  // Re-draw idle pattern after stopping / on error
  useEffect(() => {
    if (state === "idle" || state === "error") {
      const id = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) renderIdleBars(canvas);
      }, 50);
      return () => clearTimeout(id);
    }
  }, [state]);

  // ── Speech recognition setup ──────────────────────────────────────────────────

  const startSpeechRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalSegment = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalSegment += transcript;
        } else {
          interim += transcript;
        }
      }

      // Update the live interim display inside the visualizer
      setInterimText(interim);

      // Fire the callback: prefer final text, fall back to interim so the
      // chat input updates in real time as the user speaks.
      const textToEmit = finalSegment || interim;
      if (textToEmit) {
        onTranscriptRef.current?.(textToEmit);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" is benign — the browser didn't hear anything yet.
      if (event.error !== "no-speech") {
        console.warn("[SpeechRecognition] error:", event.error);
      }
    };

    // Auto-restart when recognition ends (e.g. silence timeout) while still active
    recognition.onend = () => {
      if (recognitionRef.current === recognition && analyserRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore InvalidStateError if already started
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // Ignore if already running
    }
  }, []); // deps empty — only touches refs and module-level helpers

  const stopSpeechRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    // Nullify before stop() so the onend handler won't restart it
    recognitionRef.current = null;
    try {
      recognition.stop();
    } catch {
      // Ignore if already stopped
    }
    setInterimText("");
  }, []);

  // ── Microphone helpers ────────────────────────────────────────────────────────

  const startMicrophone = useCallback(async () => {
    setState("requesting");
    setErrorMsg("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.78;

      const source = audioCtx.createMediaStreamSource(stream);
      // Connect to analyser only — do NOT route to destination
      // so the user doesn't hear their own voice with latency.
      source.connect(analyser);

      streamRef.current = stream;
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      setState("active");
      startDrawLoop();
      startSpeechRecognition();
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "Microphone permission was denied."
            : err.message
          : "Unable to access the microphone.";
      setErrorMsg(msg);
      setState("error");
    }
  }, [startDrawLoop, startSpeechRecognition]);

  const stopMicrophone = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    stopSpeechRecognition();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;

    void audioCtxRef.current?.suspend();
    audioCtxRef.current = null;

    setState("idle");
  }, [stopSpeechRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, [stopMicrophone]);

  // ── Render ────────────────────────────────────────────────────────────────────

  const isActive = state === "active";
  const isRequesting = state === "requesting";

  return (
    <div
      className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#13131a] p-3 shadow-xl"
      aria-label="Audio visualizer"
    >
      {/* Header row */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-violet-400" : "text-white/30"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z"
            />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Mic Visualizer
          </span>

          {isActive && (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              Live
            </span>
          )}

          {/* Speech-to-text unsupported badge */}
          {isActive && !speechSupported && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
              STT unavailable
            </span>
          )}
        </div>

        {isActive ? (
          <button
            id="audio-visualizer-stop"
            type="button"
            onClick={stopMicrophone}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-95"
            aria-label="Stop microphone"
          >
            <span className="h-1.5 w-1.5 rounded-sm bg-red-400" />
            Stop
          </button>
        ) : (
          <button
            id="audio-visualizer-start"
            type="button"
            onClick={() => void startMicrophone()}
            disabled={isRequesting}
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-400 transition-all hover:bg-violet-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Start microphone"
          >
            {isRequesting ? (
              <>
                <svg
                  className="h-3 w-3 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Requesting…
              </>
            ) : (
              <>
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z"
                  />
                </svg>
                Start Microphone
              </>
            )}
          </button>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="h-16 w-full rounded-lg"
        style={{ display: "block" }}
        aria-label={
          isActive
            ? "Real-time audio frequency visualizer"
            : "Audio visualizer idle state"
        }
        role="img"
      />

      {/* Live interim transcript */}
      {isActive && speechSupported && (
        <div
          aria-live="polite"
          aria-label="Live speech transcript"
          className="min-h-[1.5rem] rounded-lg border border-white/5 bg-white/5 px-3 py-1.5"
        >
          {interimText ? (
            <p className="text-[10px] italic leading-relaxed text-violet-300/70">
              {interimText}
            </p>
          ) : (
            <p className="text-[10px] text-white/20">Listening…</p>
          )}
        </div>
      )}

      {/* Error */}
      {state === "error" && errorMsg && (
        <p
          role="alert"
          className="mt-0.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-medium text-red-400"
        >
          ⚠️ {errorMsg}
        </p>
      )}
    </div>
  );
}
