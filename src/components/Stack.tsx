import { motion } from "framer-motion";

const layers = [
  {
    id: "L4",
    title: "Risk Reversal",
    body: "We configure secondary domains and strict DNS protocols. We protect your main company server from ever hitting a spam blacklist.",
    items: ["Domain warm-up", "SPF/DKIM/DMARC", "Inbox placement"],
  },
  {
    id: "L3",
    title: "Intent Data",
    body: "We write custom scripts to pull active buying signals—like recent funding or hiring surges. We only target prospects who actually have capital.",
    items: ["Signal tracking", "Intent scoring", "Account mapping"],
  },
  {
    id: "L2",
    title: "Automated Execution",
    body: "We load verified leads into a sequence engine that runs 24/7. No salaries, no sick days, no human error.",
    items: ["Sequence engine", "Auto-send", "Personalization"],
  },
  {
    id: "L1",
    title: "Inbox Triage",
    body: "We filter out the noise. You only get notified when a high-intent prospect says 'yes' and books a meeting.",
    items: ["Reply triage", "Lead routing", "Calendar sync"],
  },
];

export function Stack() {
  return (
    <section id="stack" className="relative px-6 md:px-10 py-32 md:py-48 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-10 mb-20">
        <div className="md:col-span-3">
          <div className="eyebrow">— 02 / Stack</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-4xl md:text-6xl leading-[0.95] tracking-[-0.035em] max-w-3xl">
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
            className="group grid md:grid-cols-12 gap-6 py-10 md:py-14 border-b border-hairline relative"
          >
            <div className="md:col-span-1 font-mono text-[11px] tracking-[0.18em] text-ink-soft pt-1">
              {l.id}
            </div>
            <div className="md:col-span-4">
              <h3 className="font-display text-3xl md:text-5xl tracking-[-0.035em] leading-none">
                {l.title}
              </h3>
            </div>
            <div className="md:col-span-4 text-ink-soft leading-relaxed text-base">
              {l.body}
            </div>
            <div className="md:col-span-3 flex flex-col gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-ink">
              {l.items.map((it) => (
                <div key={it} className="flex items-center gap-2">
                  <span className="w-3 h-px bg-ink" />
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
