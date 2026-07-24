"use client";

import { useState } from "react";
import { CodeCanvas } from "@/components/code-canvas";

const STARTER_CODE = `// Welcome to your AI Interview Session 🚀
// Write your solution below.

function solution(input: string): string {
  // TODO: implement your solution here
  return input;
}
`;

export default function InterviewPage() {
  const [code, setCode] = useState<string | undefined>(STARTER_CODE);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0f0f13] text-white">
      {/* Top Navigation Bar */}
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

      {/* Split-Screen Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
        {/* ─── Left Column: Chat / Video ─── */}
        <section
          id="interview-chat-panel"
          className="flex flex-col gap-4 overflow-hidden"
          aria-label="Chat and video panel"
        >
          {/* Video Placeholder */}
          <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-violet-900/30 via-[#1a1a2e] to-indigo-900/30 shadow-xl"
            style={{ height: "220px" }}
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

          {/* Chat Placeholder */}
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
            </div>

            {/* Messages area */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {/* AI Message */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
                  <span className="text-[10px] font-bold text-white">AI</span>
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gradient-to-br from-violet-900/50 to-indigo-900/30 px-4 py-2.5 shadow-md">
                  <p className="text-sm leading-relaxed text-white/80">
                    Welcome! I&apos;ll be your AI interviewer today. When you&apos;re
                    ready, let&apos;s start with a coding challenge. Feel free to ask
                    clarifying questions anytime.
                  </p>
                </div>
              </div>

              {/* User Message placeholder */}
              <div className="flex flex-row-reverse items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                  <span className="text-[10px] font-bold text-white">You</span>
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-900/40 to-teal-900/30 px-4 py-2.5 shadow-md">
                  <p className="text-sm leading-relaxed text-white/80">
                    Ready to start! What&apos;s the first problem?
                  </p>
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e2e] px-4 py-2.5">
                <input
                  id="interview-chat-input"
                  type="text"
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 outline-none"
                  aria-label="Chat message input"
                />
                <button
                  id="interview-chat-send"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md shadow-violet-600/30 transition-transform hover:scale-105 active:scale-95"
                  aria-label="Send message"
                >
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
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Right Column: Code Canvas ─── */}
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

          {/* Editor fills remaining height */}
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
