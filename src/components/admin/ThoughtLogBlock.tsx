import type { ReactNode } from "react";

type ThoughtLogBlockProps = {
  thought: string;
  defaultOpen?: boolean;
  replyAction?: ReactNode;
};

export function ThinkingIndicator() {
  return (
    <div
      className="flex items-center gap-2 py-2 text-sm italic text-gray-500 animate-pulse"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="h-3 w-3 shrink-0 animate-spin rounded-full border border-gray-600 border-t-gray-400"
        aria-hidden
      />
      Thinking…
    </div>
  );
}

function thoughtPreview(thought: string, maxLength = 72): string {
  const line = thought.replace(/\s+/g, " ").trim();
  if (!line) return "Empty reasoning block";
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength).trim()}…`;
}

export function ThoughtLogBlock({
  thought,
  defaultOpen = false,
  replyAction,
}: ThoughtLogBlockProps) {
  const preview = thoughtPreview(thought);

  return (
    <div className="space-y-2">
      <details
        open={defaultOpen}
        className="group rounded border border-gray-700/40 bg-gray-800/30"
      >
        <summary className="cursor-pointer list-none px-2 py-1.5 text-xs text-gray-500 transition-colors hover:text-gray-400 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="text-[10px] text-gray-600 transition-transform group-open:rotate-90"
              aria-hidden
            >
              ▶
            </span>
            <span className="italic">Thought process</span>
            <span className="hidden truncate text-gray-600 group-open:inline sm:inline">
              · {preview}
            </span>
          </span>
        </summary>
        <div className="mx-2 mb-2 whitespace-pre-wrap rounded border border-gray-700/50 bg-gray-900/40 p-2 text-xs leading-relaxed text-gray-400">
          {thought || "—"}
        </div>
      </details>
      {replyAction}
    </div>
  );
}
