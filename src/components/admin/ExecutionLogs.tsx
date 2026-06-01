import { useMemo, useState } from "react";
import {
  EXECUTION_LOG_ENTRIES,
  LOG_FILTERS,
  type LogEntry,
  type LogFilter,
  type LogLevel,
} from "@/lib/admin/executionLogs";

const levelTone: Record<LogLevel, string> = {
  INFO: "text-[oklch(0.98_0_0)]",
  WARNING: "text-[oklch(0.78_0.08_95)]",
  ERROR: "text-[oklch(0.62_0.22_25)]",
};

function LogLine({ entry }: { entry: LogEntry }) {
  return (
    <div className={`font-mono text-[11px] leading-relaxed tracking-[0.06em] ${levelTone[entry.level]}`}>
      <span className="text-[oklch(0.55_0_0)]">[{entry.time}]</span>{" "}
      <span>[{entry.level}]</span> <span className="text-[oklch(0.72_0_0)]">[{entry.source}]</span>{" "}
      {entry.message}
    </div>
  );
}

export function ExecutionLogs() {
  const [filter, setFilter] = useState<LogFilter>("ALL");
  const [logs, setLogs] = useState(EXECUTION_LOG_ENTRIES);

  const filteredLogs = useMemo(
    () => (filter === "ALL" ? logs : logs.filter((entry) => entry.level === filter)),
    [filter, logs],
  );

  function handleClear() {
    setLogs([]);
  }

  function handleExport() {
    const trace = logs
      .map(
        (entry) =>
          `[${entry.time}] [${entry.level}] [${entry.source}] ${entry.message}`,
      )
      .join("\n");
    console.info("[EXEC_LOGS] export trace\n", trace);
  }

  return (
    <section className="space-y-10 md:space-y-12">
      <header className="border-b border-hairline pb-8 md:pb-10">
        <div className="eyebrow mb-4">Index 004 // Execution Logs</div>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.88] tracking-[-0.04em]">
          EXEC_LOGS // 004
        </h1>
      </header>

      {/* Section 01 */}
      <section>
        <h2 className="mb-5 font-mono text-[11px] tracking-[0.2em] uppercase text-ink md:mb-6">
          01 // MASTER_EXECUTION_STREAM
        </h2>

        <div className="flex flex-col gap-4 border border-hairline px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex flex-wrap gap-2">
            {LOG_FILTERS.map((item) => {
              const isActive = filter === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-none border px-3 py-2 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                    isActive
                      ? "border-ink bg-ink text-paper"
                      : "border-hairline bg-transparent text-ink-soft hover:border-ink hover:text-ink"
                  }`}
                >
                  [{item}]
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink animate-pulse">
            WORKER_THREADS: ACTIVE
          </p>
        </div>
      </section>

      {/* Section 02 + 03 */}
      <section className="border border-hairline">
        <div className="min-h-[24rem] border-b border-hairline bg-[oklch(0.06_0_0)] px-4 py-5 md:min-h-[28rem] md:px-6 md:py-6">
          {filteredLogs.length === 0 ? (
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-[oklch(0.45_0_0)]">
              Stream empty · awaiting events
            </p>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((entry) => (
                <LogLine key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0 bg-paper sm:flex-row">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 rounded-none border-b border-hairline px-5 py-4 font-mono text-[11px] tracking-[0.16em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper sm:border-b-0 sm:border-r sm:border-hairline"
          >
            CLEAR_STREAM
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 rounded-none px-5 py-4 font-mono text-[11px] tracking-[0.16em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            EXPORT_TRACE_LOG
          </button>
        </div>
      </section>
    </section>
  );
}
