import { motion } from "framer-motion";

export function Thesis() {
  return (
    <section id="thesis" className="relative px-6 md:px-10 py-32 md:py-48">
      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-3">
          <div className="eyebrow sticky top-32">— 01 / Thesis</div>
        </div>
        <div className="md:col-span-9 max-w-4xl">
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl md:text-5xl leading-[1.05] tracking-[-0.03em] text-balance"
          >
            Hiring junior SDRs to manually scrape databases and guess emails is a broken math equation. We replace human error and inflated salaries with automated, rules-based infrastructure.
          </motion.p>

          <div className="mt-20 grid sm:grid-cols-2 gap-x-12 gap-y-10 text-base text-ink-soft leading-relaxed max-w-3xl">
            <p>Engineering, not marketing.</p>
            <p>100% primary inbox protection.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
