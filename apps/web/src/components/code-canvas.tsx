"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useRef } from "react";

export interface CodeCanvasProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  height?: string;
  className?: string;
}

export function CodeCanvas({
  value,
  onChange,
  language = "typescript",
  height = "100%",
  className = "",
}: CodeCanvasProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Focus editor on mount for immediate typing
    editor.focus();
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl ${className}`}
      style={{ height }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#252526] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs font-medium tracking-wide text-white/40">
          solution.{language === "typescript" ? "ts" : language}
        </span>
      </div>

      {/* Monaco Editor */}
      <Editor
        height="calc(100% - 40px)"
        defaultLanguage={language}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={onChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, monospace',
          fontLigatures: true,
          lineHeight: 22,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          renderLineHighlight: "all",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          formatOnPaste: true,
          formatOnType: true,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          // Remove scrollbar distractions for interview cleanliness
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
            vertical: "auto",
            horizontal: "auto",
          },
        }}
        loading={
          <div className="flex h-full items-center justify-center text-sm text-white/30">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
