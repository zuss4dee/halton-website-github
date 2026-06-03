import { motion } from "framer-motion";
import { CtaButton } from "./CtaButton";

export function Apply() {
  return (
    <section id="apply" className="relative px-5 sm:px-6 md:px-10 py-24 sm:py-32 md:py-56 border-t border-hairline overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto text-center">
        <div className="eyebrow mb-8 md:mb-10">Apply</div>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[clamp(2rem,8.5vw,9rem)] leading-[0.9] sm:leading-[0.88] tracking-[-0.045em] text-balance"
        >
          Three partners <br /> per quarter.
        </motion.h2>
        <p className="mt-8 md:mt-10 text-[15px] sm:text-base text-ink-soft max-w-md mx-auto leading-relaxed px-2">
          We cap client load so we over-deliver on every guarantee. One Q3 spot remains.
        </p>
        <div className="mt-10 md:mt-12 flex justify-center px-2">
          <CtaButton label="Claim Your Spot" className="w-full max-w-sm sm:w-auto justify-center" />
        </div>
        <div className="mt-8 md:mt-10 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
          Q3 · 1 spot remains
        </div>
      </div>
    </section>
  );
}
