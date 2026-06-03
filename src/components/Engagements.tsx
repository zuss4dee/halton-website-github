import { motion } from "framer-motion";

const profiles = [
  {
    idx: "001",
    profile: "B2B SaaS Founder",
    need: "£500k+ ARR and needs qualified meetings without building an SDR team",
    signal: "Pipeline · SaaS",
    fit: "Strong",
  },
  {
    idx: "002",
    profile: "Professional Services",
    need: "High-ticket retainers and no time to run outbound consistently",
    signal: "Outbound · B2B",
    fit: "Strong",
  },
  {
    idx: "003",
    profile: "Agency Operator",
    need: "Wants done-for-you meeting generation for client accounts",
    signal: "Partner · Scale",
    fit: "Ideal",
  },
  {
    idx: "004",
    profile: "Technical Founder",
    need: "Product is ready to sell but prospecting keeps getting pushed back",
    signal: "Sales · Founder",
    fit: "Strong",
  },
];

export function Engagements() {
  return (
    <section id="engagements" className="relative px-6 md:px-10 py-32 md:py-48 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <div className="md:col-span-3">
          <div className="eyebrow">03 / Fit</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-4xl md:text-6xl leading-[0.95] tracking-[-0.035em] max-w-3xl">
            Who we work with.
          </h2>
          <p className="mt-6 max-w-2xl text-base text-ink-soft leading-relaxed">
            High-ticket B2B founders and operators. We book qualified meetings. You close.
          </p>
        </div>
      </div>

      <div className="border-t border-hairline">
        {profiles.map((row, i) => (
          <motion.div
            key={row.idx}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.05 }}
            className="group grid grid-cols-12 gap-4 py-7 border-b border-hairline items-baseline cursor-default hover:bg-ink hover:text-paper transition-colors duration-300"
          >
            <div className="col-span-2 md:col-span-1 font-mono text-[11px] tracking-[0.18em]">{row.idx}</div>
            <div className="col-span-10 md:col-span-4 font-display text-xl md:text-3xl tracking-[-0.03em]">
              {row.profile}
            </div>
            <div className="col-span-7 md:col-span-4 text-sm md:text-base">{row.need}</div>
            <div className="col-span-5 md:col-span-2 font-mono text-[11px] tracking-[0.16em] uppercase opacity-70">
              {row.signal}
            </div>
            <div className="col-span-12 md:col-span-1 font-mono text-[11px] tracking-[0.18em] text-right opacity-70">
              {row.fit}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
