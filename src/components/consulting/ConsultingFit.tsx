import { motion } from "framer-motion";

const profiles = [
  {
    title: "Scaling Agencies",
    body: "Delivery bottlenecked by manual project management.",
  },
  {
    title: "Funded SaaS Teams",
    body: "Refusing to bloat overhead and headcount post-funding.",
  },
  {
    title: "Professional Services",
    body: "Wasting high-value billable hours on repetitive admin leaks.",
  },
  {
    title: "Founder-Led Outfits",
    body: "Trading strategic leverage for basic database data entry.",
  },
];

export function ConsultingFit() {
  return (
    <section id="fit" className="relative px-5 sm:px-6 md:px-10 py-24 sm:py-32 md:py-56 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-8 md:gap-10 mb-16 md:mb-24">
        <div className="md:col-span-3">
          <div className="eyebrow">03 / Fit</div>
        </div>
        <div className="md:col-span-9">
          <h2 className="font-display text-[clamp(2.25rem,9vw,4.5rem)] md:text-7xl leading-[0.92] tracking-[-0.04em] max-w-3xl lowercase">
            who we build for.
          </h2>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline border border-hairline">
        {profiles.map((profile, i) => (
          <motion.div
            key={profile.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="bg-paper p-8 sm:p-10 md:p-12 flex flex-col gap-5"
          >
            <h3 className="font-display text-xl sm:text-2xl tracking-[-0.03em] leading-none">{profile.title}</h3>
            <p className="text-[15px] sm:text-base text-ink-soft leading-relaxed">{profile.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
