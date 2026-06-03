import { motion } from "framer-motion";

const layers = [
  {
    id: "L4",
    title: "Risk Reversal",
    body: "You pay for meetings that happen, not effort, excuses, or busywork.",
    items: ["Domain warm-up", "SPF/DKIM/DMARC", "Inbox placement"],
  },
  {
    id: "L3",
    title: "Intent Data",
    body: "We target buyers showing intent now, not dead lists and cold noise.",
    items: ["Signal tracking", "Intent scoring", "Account mapping"],
  },
  {
    id: "L2",
    title: "Automated Execution",
    body: "Our systems run 24/7. No missed follow-ups. No dropped balls.",
    items: ["Sequence engine", "Auto-send", "Personalization"],
  },
  {
    id: "L1",
    title: "Inbox Triage",
    body: "We filter tire-kickers. Only qualified decision-makers reach your desk.",
    items: ["Reply triage", "Lead routing", "Calendar sync"],
  },
];

export function Stack() {
  return (
    <section id="stack" className="relative px-5 sm:px-6 md:px-10 py-20 sm:py-28 md:py-48 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-6 md:gap-10 mb-12 md:mb-20">
        <div className="md:col-span-3">
          <div className="eyebrow">02 / Stack</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-[clamp(2rem,8vw,3.75rem)] md:text-6xl leading-[0.95] tracking-[-0.035em] max-w-3xl">
            The Architecture.
          </h2>
        </div>
      </div>

      <div className="border-t border-hairline">
        {layers.map((l, i) => (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="group flex flex-col gap-4 py-8 sm:py-10 md:grid md:grid-cols-12 md:gap-6 md:py-14 border-b border-hairline relative"
          >
            <div className="flex items-baseline gap-4 md:contents">
              <div className="font-mono text-[11px] tracking-[0.18em] text-ink-soft shrink-0 md:col-span-1 md:pt-1">
                {l.id}
              </div>
              <div className="md:col-span-4 min-w-0">
                <h3 className="font-display text-2xl sm:text-3xl md:text-5xl tracking-[-0.035em] leading-none">
                  {l.title}
                </h3>
              </div>
            </div>
            <div className="md:col-span-4 text-ink-soft leading-relaxed text-[15px] sm:text-base pl-0 md:pl-0">
              {l.body}
            </div>
            <div className="md:col-span-3 flex flex-col gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-ink">
              {l.items.map((it) => (
                <div key={it} className="flex items-center gap-2">
                  <span className="w-3 h-px bg-ink shrink-0" />
                  {it}
                </div>
              ))}
            </div>
            <motion.div
              aria-hidden
              className="absolute left-0 top-0 h-px bg-ink"
              initial={{ width: 0 }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.1 + i * 0.05, ease: [0.77, 0, 0.175, 1] }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
