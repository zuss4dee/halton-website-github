import { motion } from "framer-motion";

const ps = [
  { n: "I", t: "Demos over deliverability", b: "We don't sell open rates, clicks, or marketing vanity metrics. We deliver booked sales calls." },
  { n: "II", t: "Assets over agencies", b: "You aren't renting an agency retainer. You are investing in permanent revenue infrastructure." },
  { n: "III", t: "Engineers over marketers", b: "Outbound is a math equation of intent data and server protocols. We write the code to solve it." },
  { n: "IV", t: "Signals over spam", b: "Pitching a founder the exact day they raise a Series A isn't spam. It's perfectly timed data orchestration." },
];

export function Principles() {
  return (
    <section id="index" className="relative px-6 md:px-10 py-32 md:py-44 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <div className="md:col-span-3">
          <div className="eyebrow">— 04 / Index</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-4xl md:text-6xl leading-[0.95] tracking-[-0.035em] max-w-2xl">
            The Math.
          </h2>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-hairline border border-hairline">
        {ps.map((p, i) => (
          <motion.div
            key={p.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.08 }}
            className="bg-paper p-8 md:p-12 min-h-[260px] flex flex-col justify-between"
          >
            <div className="font-mono text-[11px] tracking-[0.2em] text-ink-soft">{p.n}</div>
            <div>
              <h3 className="font-display text-2xl md:text-4xl tracking-[-0.03em] mb-3">{p.t}</h3>
              <p className="text-ink-soft text-sm md:text-base leading-relaxed max-w-md">{p.b}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
