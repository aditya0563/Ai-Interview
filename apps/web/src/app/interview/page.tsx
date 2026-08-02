"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CodeCanvas } from "@/components/code-canvas";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { trpc } from "@/trpc/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "assistant" | "user";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STARTER_CODE = `// Welcome to your AI Interview Session 🚀
// Write your solution below.

function solution(input: string): string {
  // TODO: implement your solution here
  return input;
}
`;

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-0",
    role: "assistant",
    content:
      "Welcome! I'll be your AI interviewer today. When you're ready, let's start with a coding challenge. Feel free to ask clarifying questions anytime.",
  },
];

// Placeholder interview ID (must be a valid CUID2) used until session management is wired up.
// Replace this with a real CUID2 once the create-interview flow exists.
const DEMO_INTERVIEW_ID = "tz4a98xxat96iws9zvli330b";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Code editor state
  const [code, setCode] = useState<string | undefined>(STARTER_CODE);

  // Chat state
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState<string>("");

  // ── tRPC mutation ────────────────────────────────────────────────────────────
  const submitAnswer = trpc.interviews.submitAnswer.useMutation({
    onSuccess(data) {
      // Append the AI reply returned from the server
      const aiMessage: Message = {
        id: `msg-ai-${Date.now()}`,
        role: "assistant",
        content: data.aiResponse,
      };
      setMessages((prev) => [...prev, aiMessage]);
    },
    onError(err) {
      // Surface the error as a system-style message in the chat
      const errMessage: Message = {
        id: `msg-err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Something went wrong: ${err.message}`,
      };
      setMessages((prev) => [...prev, errMessage]);
    },
  });

  const handleFinalTranscript = useCallback(
    (text: string) => {
      if (!text || !text.trim()) return;
      const trimmed = text.trim();
      setChatInput(trimmed);

      if (submitAnswer.isPending) return;

      // Optimistic update
      const userMessage: Message = {
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMessage]);
      setChatInput("");

      // Call the server
      submitAnswer.mutate({
        interviewId: DEMO_INTERVIEW_ID,
        message: trimmed,
        code: code ?? "",
      });
    },
    [code, submitAnswer]
  );

  const handleFinalTranscriptRef = useRef(handleFinalTranscript);
  useEffect(() => {
    handleFinalTranscriptRef.current = handleFinalTranscript;
  }, [handleFinalTranscript]);

  const startRecording = useCallback(async () => {
    setMicError(null);
    audioChunksRef.current = [];
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access is unavailable. Please ensure you are using HTTPS and a modern browser."
        );
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setStream(mediaStream);

      const options: MediaRecorderOptions = {};
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          options.mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options.mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options.mimeType = "audio/mp4";
        }
      }

      const mediaRecorder = new MediaRecorder(mediaStream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        audioChunksRef.current = [];

        try {
          setIsTranscribing(true);
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Server error (${response.status}) during transcription`);
          }

          const data = await response.json();
          const transcript = data?.transcript ?? "";

          if (transcript && typeof transcript === "string") {
            handleFinalTranscriptRef.current(transcript);
          }
        } catch (error) {
          console.error("Error transcribing audio:", error);
          setMicError("Failed to transcribe speech. Please try again.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: unknown) {
      let msg = "Unable to access the microphone.";
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        msg = "Microphone permission was denied.";
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setMicError(msg);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setStream((prevStream) => {
      if (prevStream) {
        prevStream.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Scroll anchor for the messages list
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Scroll the message area to the bottom whenever messages change. */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);



  /** Optimistically append the user message then fire the mutation. */
  const handleSend = () => {
    const trimmed = chatInput.trim();
    if (!trimmed || submitAnswer.isPending) return;

    // Optimistic update
    const userMessage: Message = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    // Call the server
    submitAnswer.mutate({
      interviewId: DEMO_INTERVIEW_ID,
      message: trimmed,
      code: code ?? "",
    });
  };

  /** Allow submitting with Enter (Shift+Enter inserts a newline). */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isBusy = submitAnswer.isPending;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0f0f13] text-white">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0f0f13]/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-lg shadow-violet-600/30">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-wide text-white/90">
            AI Interview
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            Live Session
          </span>
        </div>
      </header>

      {/* ── Split-Screen Grid ──────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">

        {/* ── Left Column: Video + Chat ───────────────────────────────────── */}
        <section
          id="interview-chat-panel"
          className="flex flex-col gap-4 overflow-hidden"
          aria-label="Chat and video panel"
        >
          {/* Control Panel */}
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#13131a] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isRecording ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-white/90">
                    Interview Session
                  </h3>
                  <p className="text-[10px] text-white/40">
                    {isRecording
                      ? "Recording active"
                      : isTranscribing
                        ? "Transcribing audio..."
                        : "Ready to start"}
                  </p>
                </div>
              </div>

              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isTranscribing}
                  className="group relative overflow-hidden rounded-lg bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all hover:scale-105 hover:bg-violet-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                  <span className="relative flex items-center gap-2">
                    {isTranscribing ? "Transcribing..." : "Start Interview"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-semibold text-red-400 shadow-md transition-all hover:scale-105 hover:bg-red-500/20 active:scale-95"
                >
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  End Interview
                </button>
              )}
            </div>

            {micError && (
              <div className="mt-1 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 shadow-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Microphone Error
                </div>
                <p className="mt-1 opacity-80">{micError}</p>
              </div>
            )}
          </div>

          {/* Video Placeholder */}
          <div
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-violet-900/30 via-[#1a1a2e] to-indigo-900/30 shadow-xl"
            style={{ height: "200px" }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_70%)]" />
            <div className="relative flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/20">
                <svg
                  className="h-8 w-8 text-violet-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white/70">Video Feed</p>
                <p className="mt-0.5 text-xs text-white/30">Camera placeholder</p>
              </div>
            </div>
          </div>

          <AudioVisualizer stream={stream} />

          {/* Chat Panel */}
          <div
            id="interview-chat-messages"
            className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#13131a] shadow-xl"
          >
            {/* Chat header */}
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-violet-500 shadow-sm shadow-violet-500/50" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Live Chat
              </span>
              <span className="ml-auto text-xs tabular-nums text-white/20">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Scrollable messages list */}
            <div
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
            >
              {messages.map((msg) =>
                msg.role === "assistant" ? (
                  // ── Assistant bubble ──────────────────────────────────────
                  <div key={msg.id} className="flex items-start gap-3">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md"
                      aria-hidden="true"
                    >
                      <span className="text-[10px] font-bold text-white">AI</span>
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gradient-to-br from-violet-900/50 to-indigo-900/30 px-4 py-2.5 shadow-md">
                      <p className="text-sm leading-relaxed text-white/80">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  // ── User bubble ───────────────────────────────────────────
                  <div key={msg.id} className="flex flex-row-reverse items-start gap-3">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md"
                      aria-hidden="true"
                    >
                      <span className="text-[10px] font-bold text-white">You</span>
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-900/40 to-teal-900/30 px-4 py-2.5 shadow-md">
                      <p className="text-sm leading-relaxed text-white/80">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* AI typing indicator while the mutation is in-flight */}
              {isBusy && (
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md"
                    aria-hidden="true"
                  >
                    <span className="text-[10px] font-bold text-white">AI</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-gradient-to-br from-violet-900/50 to-indigo-900/30 px-4 py-3 shadow-md">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
                    </div>
                    <span className="text-xs font-medium italic text-violet-300/80">
                      AI is thinking...
                    </span>
                  </div>
                </div>
              )}

              {/* Invisible scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e2e] px-4 py-2.5 transition-colors focus-within:border-violet-500/50">
                <input
                  id="interview-chat-input"
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isBusy ? "AI is thinking…" : "Type a message…"}
                  disabled={isBusy}
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 outline-none disabled:cursor-not-allowed"
                  aria-label="Chat message input"
                  autoComplete="off"
                />
                <button
                  id="interview-chat-send"
                  type="button"
                  onClick={handleSend}
                  disabled={!chatInput.trim() || isBusy}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md shadow-violet-600/30 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  aria-label="Send message"
                >
                  {isBusy ? (
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
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
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-white/20">
                Press{" "}
                <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px]">
                  Enter
                </kbd>{" "}
                to send
              </p>
            </div>
          </div>
        </section>

        {/* ── Right Column: Code Canvas ───────────────────────────────────── */}
        <section
          id="interview-code-panel"
          className="flex min-h-0 flex-col overflow-hidden"
          aria-label="Code editor panel"
        >
          {/* Panel header */}
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-violet-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Code Editor
              </span>
            </div>
            <span className="rounded-md bg-violet-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-violet-400">
              TypeScript
            </span>
          </div>

          {/* Editor — value and onChange wired to code state */}
          <CodeCanvas
            value={code}
            onChange={setCode}
            language="typescript"
            height="100%"
            className="flex-1"
          />
        </section>
      </div>
    </main>
  );
}
