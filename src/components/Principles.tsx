import { motion } from "framer-motion";

const ps = [
  { n: "I", t: "Meetings over metrics", b: "Open rates don't pay rent. Booked calls with buyers do." },
  { n: "II", t: "Revenue over hope", b: "Stop renting outcomes from agencies. Build a pipeline you can forecast." },
  { n: "III", t: "Execution over error", b: "Humans miss follow-ups. Systems don't." },
  { n: "IV", t: "Buyers over lists", b: "Cold lists are a tax. Intent is an advantage." },
];

export function Principles() {
  return (
    <section id="index" className="relative px-5 sm:px-6 md:px-10 py-20 sm:py-28 md:py-44 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-6 md:gap-10 mb-12 md:mb-16">
        <div className="md:col-span-3">
          <div className="eyebrow">04 / Index</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-[clamp(2rem,8vw,3.75rem)] md:text-6xl leading-[0.95] tracking-[-0.035em] max-w-2xl">
            The Math.
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-hairline border border-hairline">
        {ps.map((p, i) => (
          <motion.div
            key={p.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.08 }}
            className="bg-paper p-6 sm:p-8 md:p-12 min-h-[200px] sm:min-h-[220px] md:min-h-[260px] flex flex-col justify-between"
          >
            <div className="font-mono text-[11px] tracking-[0.2em] text-ink-soft">{p.n}</div>
            <div>
              <h3 className="font-display text-xl sm:text-2xl md:text-4xl tracking-[-0.03em] mb-3">{p.t}</h3>
              <p className="text-ink-soft text-sm md:text-base leading-relaxed max-w-md">{p.b}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
