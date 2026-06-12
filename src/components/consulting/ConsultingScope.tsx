import { motion } from "framer-motion";

const areas = [
  {
    id: "A1",
    title: "AI Adoption & Strategy",
    body: "Guiding your leadership team through profitable AI adoption. We audit your current business model, cut through the hype, and map out exactly where AI can reduce overhead and maximize your team's output.",
  },
  {
    id: "A2",
    title: "Custom AI Solutions",
    body: "Engineering proprietary AI software tailored exclusively to your business. We don't install generic, off-the-shelf tools—we build custom code assets designed around your unique operating procedures.",
  },
  {
    id: "A3",
    title: "Workflow Automation",
    body: "Replacing slow, manual back-office tasks with automated infrastructure. We eliminate repetitive data transfers, spreadsheet updates, and day-to-day administrative bottlenecks so your team can focus on growth.",
  },
  {
    id: "A4",
    title: "Intelligent Operations",
    body: "Training AI to handle your complex company communication and messy documentation. We deploy secure systems that read incoming emails, analyze PDFs, and route business data instantly with zero human error.",
  },
];

export function ConsultingScope() {
  return (
    <section id="scope" className="relative px-5 sm:px-6 md:px-10 py-24 sm:py-32 md:py-56 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-8 md:gap-10 mb-16 md:mb-24">
        <div className="md:col-span-3">
          <div className="eyebrow md:sticky md:top-32">01 / Systems</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-[clamp(2.25rem,9vw,4.5rem)] md:text-7xl leading-[0.92] tracking-[-0.04em] max-w-3xl lowercase">
            how we help.
          </h2>
        </div>
      </div>

      <div className="border-t border-hairline">
        {areas.map((area, i) => (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="group flex flex-col gap-5 py-10 sm:py-12 md:grid md:grid-cols-12 md:gap-8 md:py-16 border-b border-hairline relative"
          >
            <div className="flex items-baseline gap-4 md:contents">
              <div className="font-mono text-[11px] tracking-[0.18em] text-ink-soft shrink-0 md:col-span-1 md:pt-1">
                {area.id}
              </div>
              <div className="md:col-span-4 min-w-0">
                <h3 className="font-display text-2xl sm:text-3xl md:text-5xl tracking-[-0.035em] leading-none">
                  {area.title}
                </h3>
              </div>
            </div>
            <div className="md:col-span-7 text-ink-soft leading-relaxed text-[15px] sm:text-base max-w-2xl">{area.body}</div>
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
