"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VisualizerState = "idle" | "active";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

const FFT_SIZE = 256;
let sharedAudioContext: AudioContext | null = null;

function getSpeechRecognitionCtor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return (window.SpeechRecognition ?? window.webkitSpeechRecognition) ?? null;
}

export function AudioVisualizer({ stream, onTranscript }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const retryCount = useRef<number>(0);
  const lastCrashTime = useRef<number>(0);

  const [interimText, setInterimText] = useState<string>("");
  const [speechSupported] = useState<boolean>(() => getSpeechRecognitionCtor() !== null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.moveTo(0, height - 2);
    ctx.lineTo(width, height - 2);
    ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i]! / 255.0;
      const y = height - (v * height * 0.8) - 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(139, 92, 246, 0.8)");
    grad.addColorStop(1, "rgba(99, 102, 241, 0.1)");
    
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(167, 139, 250, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    rafIdRef.current = requestAnimationFrame(drawWaveform);
  }, []);

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

    const ro = new ResizeObserver(() => {
      applyDPR();
      if (!stream) drawIdle();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [stream, drawIdle]);

  useEffect(() => {
    let isActive = true;

    async function setupAudio() {
      if (!stream) return;

      if (!sharedAudioContext) {
        sharedAudioContext = new AudioContext();
      }

      if (sharedAudioContext.state === "suspended") {
        await sharedAudioContext.resume();
      }

      if (!isActive) return;

      const audioCtx = sharedAudioContext;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      rafIdRef.current = requestAnimationFrame(drawWaveform);

      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
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
          setInterimText(interim);
          const textToEmit = finalSegment || interim;
          if (textToEmit) {
            onTranscriptRef.current?.(textToEmit, !!finalSegment);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error !== "no-speech") {
            console.warn("[SpeechRecognition] error:", event.error);
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current === recognition && stream) {
            const now = Date.now();
            if (now - lastCrashTime.current < 5000) {
              retryCount.current += 1;
            } else {
              retryCount.current = 0;
            }
            
            lastCrashTime.current = now;

            if (retryCount.current >= 3) {
              alert("Speech recognition disconnected. Please check your microphone permissions and refresh.");
              return;
            }

            try { recognition.start(); } catch {}
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }
    }

    if (stream) {
      setupAudio();
    } else {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (recognitionRef.current) {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        try { recognition.stop(); } catch {}
      }
      setInterimText("");
      
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      
      audioCtxRef.current = null;
      
      drawIdle();
    }
    
    return () => {
      isActive = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (recognitionRef.current) {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        try { recognition.stop(); } catch {}
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      audioCtxRef.current = null;
    };
  }, [stream, drawWaveform, drawIdle]);

  return (
    <div
      className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#13131a] p-3 shadow-xl"
      aria-label="Audio visualizer"
    >
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
  className={`h-3.5 w-3.5 transition-colors ${stream ? "text-violet-400" : "text-white/30"}`}
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 018 0z"
  />
</svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Mic Visualizer
          </span>

          {!!stream && (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              Live
            </span>
          )}

          {!!stream && !speechSupported && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
              STT unavailable
            </span>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="h-16 w-full rounded-lg"
        style={{ display: "block" }}
        aria-label={
          stream
            ? "Real-time audio frequency visualizer"
            : "Audio visualizer idle state"
        }
        role="img"
      />

      {!!stream && speechSupported && (
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
    </div>
  );
}
