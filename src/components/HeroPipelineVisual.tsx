import { motion, animate } from "framer-motion";
import { useEffect, useState } from "react";

const PIPELINE_X = 180;

const stages = [
  { id: "01", label: "Intent signal", y: 36 },
  { id: "02", label: "Qualified", y: 96 },
  { id: "03", label: "Meeting booked", y: 156 },
  { id: "04", label: "Your calendar", y: 216 },
] as const;

const flowPath = `M ${PIPELINE_X} ${stages[0].y} L ${PIPELINE_X} ${stages[stages.length - 1].y}`;

export function HeroPipelineVisual() {
  const [meetingsBooked, setMeetingsBooked] = useState(0);

  useEffect(() => {
    const controls = animate(0, 12, {
      duration: 2.4,
      delay: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setMeetingsBooked(Math.round(v)),
    });
    return controls.stop;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="relative ml-auto w-full max-w-[380px]"
      aria-hidden
    >
      <div className="relative flex min-h-[400px] flex-col border border-hairline bg-paper noise">
        {[
          "top-0 left-0",
          "top-0 right-0",
          "bottom-0 left-0",
          "bottom-0 right-0",
        ].map((p) => (
          <div
            key={p}
            className={`pointer-events-none absolute ${p} h-3 w-3 border-ink ${
              p.includes("top") ? "border-t" : "border-b"
            } ${p.includes("left") ? "border-l" : "border-r"}`}
          />
        ))}

        <div className="flex items-center gap-2 px-4 pb-2 pt-4 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
          <motion.span
            className="inline-block h-1.5 w-1.5 shrink-0 bg-ink"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          Live · booking.flow
        </div>

        <div className="relative min-h-0 flex-1 px-3 pb-2">
          <svg
            viewBox="0 0 360 252"
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full text-ink"
          >
            <motion.path
              d={flowPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.35"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, delay: 1, ease: [0.77, 0, 0.175, 1] }}
            />

            {stages.map((stage, i) => (
              <motion.g
                key={stage.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.9 + i * 0.12 }}
              >
                <circle
                  cx={PIPELINE_X}
                  cy={stage.y}
                  r="4"
                  fill="var(--color-paper)"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <text
                  x="148"
                  y={stage.y + 4}
                  textAnchor="end"
                  className="fill-current"
                  style={{
                    font: "9px ui-monospace, monospace",
                    letterSpacing: "0.12em",
                    opacity: 0.45,
                  }}
                >
                  {stage.id}
                </text>
                <text
                  x="204"
                  y={stage.y + 4}
                  className="fill-current"
                  style={{ font: "9px ui-monospace, monospace", letterSpacing: "0.1em" }}
                >
                  {stage.label.toUpperCase()}
                </text>
              </motion.g>
            ))}

            <motion.circle
              r="5"
              fill="currentColor"
              initial={{ offsetDistance: "0%", opacity: 0 }}
              animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2.8,
                delay: 2.2,
                repeat: Infinity,
                repeatDelay: 1.6,
                ease: "easeInOut",
              }}
              style={{ offsetPath: `path('${flowPath}')` } as React.CSSProperties}
            />
          </svg>
        </div>

        <div className="shrink-0 border-t border-hairline px-4 py-4">
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft">
            Meetings booked · 7d
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl tracking-[-0.04em] text-ink">{meetingsBooked}</span>
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">qualified</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
