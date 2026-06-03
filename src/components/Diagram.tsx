import { motion } from "framer-motion";

/**
 * Subtle data-flow visualization. Animates strokes drawing in and a single
 * pulse traveling the path.
 */
export function Diagram() {
  return (
    <section className="relative px-6 md:px-10 py-32 md:py-44 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-3">
          <div className="eyebrow">Booking / Live</div>
          <p className="mt-4 text-ink-soft text-sm leading-relaxed max-w-xs">
            We find prospects, read intent, qualify replies, and book meetings on
            your calendar. You take the close. Every step is visible to you.
          </p>
        </div>
        <div className="md:col-span-9">
          <div className="relative aspect-[16/9] border border-hairline noise bg-paper">
            <svg viewBox="0 0 1600 900" className="absolute inset-0 w-full h-full">
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                </marker>
              </defs>

              {/* nodes */}
              {[
                { x: 120, y: 450, label: "PROSPECT" },
                { x: 480, y: 220, label: "TARGET" },
                { x: 480, y: 680, label: "INTENT" },
                { x: 880, y: 450, label: "QUALIFIED" },
                { x: 1240, y: 250, label: "BOOKED" },
                { x: 1240, y: 650, label: "CLOSE" },
              ].map((n, i) => (
                <motion.g
                  key={n.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 * i }}
                >
                  <rect
                    x={n.x - 80}
                    y={n.y - 28}
                    width="160"
                    height="56"
                    fill="var(--color-paper)"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    className="fill-current"
                    style={{ font: "11px ui-monospace, monospace", letterSpacing: "0.18em" }}
                  >
                    {n.label}
                  </text>
                </motion.g>
              ))}

              {/* paths */}
              {[
                "M200,450 C320,450 360,220 480,220",
                "M200,450 C320,450 360,680 480,680",
                "M560,220 C700,220 760,450 880,450",
                "M560,680 C700,680 760,450 880,450",
                "M960,450 C1080,450 1120,250 1240,250",
                "M960,450 C1080,450 1120,650 1240,650",
              ].map((d, i) => (
                <motion.path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, delay: 0.4 + i * 0.1, ease: [0.77, 0, 0.175, 1] }}
                  markerEnd="url(#arr)"
                />
              ))}

              {/* pulses */}
              {[
                "M200,450 C320,450 360,220 480,220",
                "M560,220 C700,220 760,450 880,450",
                "M960,450 C1080,450 1120,250 1240,250",
              ].map((d, i) => (
                <g key={`p-${i}`}>
                  <motion.circle
                    r="4"
                    fill="currentColor"
                    initial={{ offsetDistance: "0%", opacity: 0 }}
                    animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: 3.2,
                      delay: 2 + i * 0.4,
                      repeat: Infinity,
                      repeatDelay: 1.2,
                      ease: "easeInOut",
                    }}
                    style={{ offsetPath: `path('${d}')` } as React.CSSProperties}
                  />
                </g>
              ))}
            </svg>

            {/* corner ticks */}
            {[
              "top-0 left-0",
              "top-0 right-0",
              "bottom-0 left-0",
              "bottom-0 right-0",
            ].map((p) => (
              <div key={p} className={`absolute ${p} w-3 h-3 border-ink ${
                p.includes("top") ? "border-t" : "border-b"
              } ${p.includes("left") ? "border-l" : "border-r"}`} />
            ))}

            <div className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              FIG.01 · booking.flow
            </div>
            <div className="absolute bottom-3 right-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              live · booking flow
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
