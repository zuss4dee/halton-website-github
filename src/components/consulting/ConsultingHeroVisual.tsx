import { motion, animate } from "framer-motion";
import { useEffect, useState } from "react";

const phases = [
  { label: "audit", angle: -90 },
  { label: "architect", angle: 0 },
  { label: "install", angle: 90 },
  { label: "handoff", angle: 180 },
] as const;

const CX = 160;
const CY = 160;
const R = 108;

type ConsultingHeroVisualProps = {
  className?: string;
};

export function ConsultingHeroVisual({ className = "" }: ConsultingHeroVisualProps) {
  const [active, setActive] = useState(0);
  const [overhead, setOverhead] = useState(68);
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    const phaseTimer = setInterval(() => setActive((p) => (p + 1) % phases.length), 2800);
    return () => clearInterval(phaseTimer);
  }, []);

  useEffect(() => {
    const overheadControls = animate(68, 12, {
      duration: 3.2,
      delay: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setOverhead(Math.round(v)),
    });
    const spinControls = animate(0, 360, {
      duration: 28,
      repeat: Infinity,
      ease: "linear",
      onUpdate: (v) => setSpin(v),
    });
    return () => {
      overheadControls.stop();
      spinControls.stop();
    };
  }, []);

  return (
    <div className={`relative select-none ${className}`.trim()} aria-hidden>
      {/* Ghost overhead — sits behind the orbit, contained in the right column */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.span
          className="font-display text-[clamp(5rem,18vw,9.5rem)] leading-none tracking-[-0.06em] text-ink/[0.07] tabular-nums"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {overhead}%
        </motion.span>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto aspect-square w-full"
      >
        <svg viewBox="0 0 320 320" className="h-full w-full overflow-visible text-ink">
          {/* Outer tick ring */}
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
            const x1 = CX + (R + 34) * Math.cos(a);
            const y1 = CY + (R + 34) * Math.sin(a);
            const x2 = CX + (R + (i % 4 === 0 ? 42 : 38)) * Math.cos(a);
            const y2 = CY + (R + (i % 4 === 0 ? 42 : 38)) * Math.sin(a);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeOpacity={i % 4 === 0 ? 0.22 : 0.08}
                strokeWidth="1"
              />
            );
          })}

          <motion.circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.18"
            strokeDasharray="3 7"
            animate={{ rotate: 360 }}
            transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          />

          {phases.map((phase, i) => {
            const rad = (phase.angle * Math.PI) / 180;
            const x = CX + R * Math.cos(rad);
            const y = CY + R * Math.sin(rad);
            const isActive = i === active;
            const labelOffset =
              phase.angle === -90 ? { dx: 0, dy: -18 } : phase.angle === 90 ? { dx: 0, dy: 24 } : { dx: 0, dy: 5 };

            return (
              <g key={phase.label}>
                <motion.path
                  d={`M ${CX} ${CY} Q ${(CX + x) / 2 + (phase.angle === 0 ? 20 : phase.angle === 180 ? -20 : 0)} ${(CY + y) / 2 + (phase.angle === 90 ? 20 : phase.angle === -90 ? -20 : 0)} ${x} ${y}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: isActive ? 0.55 : 0.14,
                  }}
                  transition={{ duration: 0.8, ease: [0.77, 0, 0.175, 1] }}
                />
                <motion.circle
                  cx={x}
                  cy={y}
                  r={isActive ? 7 : 5}
                  fill="var(--color-paper)"
                  stroke="currentColor"
                  strokeWidth="1"
                  animate={{ scale: isActive ? [1, 1.12, 1] : 1 }}
                  transition={{ duration: 2.2, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
                />
                <text
                  x={x + labelOffset.dx}
                  y={y + labelOffset.dy}
                  textAnchor="middle"
                  className="fill-current font-mono lowercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    opacity: isActive ? 1 : 0.35,
                  }}
                >
                  {phase.label}
                </text>
              </g>
            );
          })}

          {/* Orbiting marker */}
          <g
            style={{
              transform: `rotate(${spin}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
            }}
          >
            <circle cx={CX} cy={CY - R} r="4.5" fill="currentColor" />
            <circle cx={CX} cy={CY - R} r="10" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
          </g>

          {/* Hub */}
          <rect
            x={CX - 22}
            y={CY - 22}
            width={44}
            height={44}
            fill="var(--color-paper)"
            stroke="currentColor"
            strokeWidth="1"
          />
          <motion.text
            key={active}
            x={CX}
            y={CY + 4}
            textAnchor="middle"
            className="fill-current font-mono lowercase"
            style={{ fontSize: 9, letterSpacing: "0.16em" }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {phases[active].label}
          </motion.text>
        </svg>

        <motion.p
          className="absolute -bottom-2 left-1/2 w-max -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] lowercase text-ink-soft"
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          consulting orbit · live
        </motion.p>
      </motion.div>
    </div>
  );
}
