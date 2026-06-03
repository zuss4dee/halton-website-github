import { motion } from "framer-motion";

export function Thesis() {
  return (
    <section id="thesis" className="relative px-6 md:px-10 py-32 md:py-48">
      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-3">
          <div className="eyebrow sticky top-32">01 / Thesis</div>
        </div>
        <div className="md:col-span-9 max-w-4xl">
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl md:text-5xl leading-[1.05] tracking-[-0.03em] text-balance"
          >
            Agencies sell activity. We book meetings with buyers who show up ready to buy.
          </motion.p>

          <div className="mt-20 grid sm:grid-cols-2 gap-x-12 gap-y-10 text-base text-ink-soft leading-relaxed max-w-3xl">
            <p>10-person output. Zero payroll.</p>
            <p>Done-for-you. Not another tool.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
