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
    <section id="engagements" className="relative px-5 sm:px-6 md:px-10 py-20 sm:py-28 md:py-48 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-6 md:gap-10 mb-12 md:mb-16">
        <div className="md:col-span-3">
          <div className="eyebrow">03 / Fit</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-[clamp(2rem,8vw,3.75rem)] md:text-6xl leading-[0.95] tracking-[-0.035em] max-w-3xl">
            Who we work with.
          </h2>
          <p className="mt-4 md:mt-6 max-w-2xl text-[15px] sm:text-base text-ink-soft leading-relaxed">
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
            className="group flex flex-col gap-3 py-7 sm:gap-4 border-b border-hairline md:grid md:grid-cols-12 md:gap-4 md:items-baseline cursor-default hover:bg-ink hover:text-paper transition-colors duration-300 -mx-5 px-5 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
          >
            <div className="flex items-baseline justify-between gap-4 md:contents">
              <div className="font-mono text-[11px] tracking-[0.18em] shrink-0 md:col-span-1">
                {row.idx}
              </div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-70 md:hidden">
                {row.fit}
              </div>
            </div>
            <div className="font-display text-xl sm:text-2xl md:col-span-4 md:text-3xl tracking-[-0.03em]">
              {row.profile}
            </div>
            <div className="text-sm sm:text-base md:col-span-4 leading-relaxed">{row.need}</div>
            <div className="flex flex-wrap items-center justify-between gap-2 md:contents">
              <div className="font-mono text-[11px] tracking-[0.16em] uppercase opacity-70 md:col-span-2">
                {row.signal}
              </div>
              <div className="hidden md:block md:col-span-1 font-mono text-[11px] tracking-[0.18em] text-right opacity-70">
                {row.fit}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
