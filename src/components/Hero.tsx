import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import { CtaButton } from "./CtaButton";

const word: Variants = {
  hidden: { y: "110%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: 1.1, delay: 0.15 + i * 0.08, ease: [0.77, 0, 0.175, 1] as const },
  }),
};

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section id="top" ref={ref} className="relative min-h-screen flex flex-col justify-between pt-32 pb-10 px-6 md:px-10">
      {/* Grid backdrop */}
      <div className="absolute inset-0 grid-bg opacity-[0.6] pointer-events-none" />
      <div className="absolute inset-x-0 top-24 h-px hairline" />

      {/* Top meta */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="relative flex items-start justify-between"
      >
        <div className="eyebrow">
          <span className="inline-block w-2 h-2 bg-ink mr-2 -mb-[1px]" />
          Index 001 — Growth Infrastructure
        </div>
        <div className="eyebrow hidden md:block max-w-[18ch] text-right">
          A private practice for category-defining operators
        </div>
      </motion.div>

      {/* Headline */}
      <motion.div style={{ y, opacity }} className="relative">
        <h1 className="font-display text-[clamp(3.5rem,12vw,12rem)] leading-[0.86] tracking-[-0.045em] text-balance">
          {["Pipeline,", "engineered."].map((w, i) => (
            <span key={i} className="block overflow-hidden">
              <motion.span variants={word} initial="hidden" animate="show" custom={i} className="block">
                {w}
              </motion.span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-5 md:col-start-1">
            <p className="text-base md:text-lg text-ink-soft max-w-md leading-relaxed">
              We build custom data architecture that puts qualified B2B SaaS demos on your calendar. Zero headcount required.
            </p>
          </div>
          <div className="md:col-span-4 md:col-start-9 flex md:justify-end">
            <CtaButton />
          </div>
        </div>
      </motion.div>

      {/* Bottom meta row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="relative mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft"
      >
        <div>
          <div className="text-ink mb-2">EST. MMXX</div>
          <div>Zurich · NYC</div>
        </div>
        <div>
          <div className="text-ink mb-2">Engagements / yr</div>
          <div>6 — by referral</div>
        </div>
        <div>
          <div className="text-ink mb-2">Avg. uplift</div>
          <div>2.4× pipeline · 18 mo</div>
        </div>
        <div>
          <div className="text-ink mb-2">Scope</div>
          <div>Series B → IPO</div>
        </div>
      </motion.div>
    </section>
  );
}
