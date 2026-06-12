import { motion } from "framer-motion";

const phases = [
  {
    step: "01",
    title: "01 / Audit",
    body: "We map your operational workflows and isolate every manual time leak.",
  },
  {
    step: "02",
    title: "02 / Architect",
    body: "We build the custom backend blueprint and state-machine integrations.",
  },
  {
    step: "03",
    title: "03 / Install",
    body: "We deploy custom edge functions, secure LLM links, and agentic scripts.",
  },
  {
    step: "04",
    title: "04 / Handoff",
    body: "We turn the key. The systems run permanently. You own the code asset forever.",
  },
];

export function ConsultingProcess() {
  return (
    <section id="process" className="relative px-5 sm:px-6 md:px-10 py-24 sm:py-32 md:py-56 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-8 md:gap-10 mb-16 md:mb-24">
        <div className="md:col-span-3">
          <div className="eyebrow">02 / Roadmap</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-[clamp(2.25rem,9vw,4.5rem)] md:text-7xl leading-[0.92] tracking-[-0.04em] max-w-3xl lowercase">
            the roadmap.
          </h2>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline border border-hairline">
        {phases.map((phase, i) => (
          <motion.div
            key={phase.step}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="bg-paper p-8 sm:p-10 md:p-12 flex flex-col gap-5"
          >
            <h3 className="font-display text-xl sm:text-2xl tracking-[-0.03em] leading-none">{phase.title}</h3>
            <p className="text-[15px] sm:text-base text-ink-soft leading-relaxed">{phase.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
