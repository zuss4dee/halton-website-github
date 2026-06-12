import { motion } from "framer-motion";
import { CtaButton } from "@/components/CtaButton";
import { CAL_DISCOVERY_URL } from "@/lib/siteLinks";

export function ConsultingCta() {
  return (
    <section id="apply" className="relative px-5 sm:px-6 md:px-10 py-28 sm:py-40 md:py-64 border-t border-hairline overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[clamp(2.25rem,9vw,8rem)] leading-[0.88] sm:leading-[0.86] tracking-[-0.05em] text-balance lowercase"
        >
          eliminate manual execution.
        </motion.h2>
        <p className="mt-10 md:mt-14 text-[15px] sm:text-base text-ink-soft max-w-md mx-auto leading-relaxed px-2">
          We will find your two biggest operational leaks and design the exact technical blueprint to automate them.
        </p>
        <div className="mt-12 md:mt-16 flex justify-center px-2">
          <CtaButton
            label="Book an Operational Audit"
            href={CAL_DISCOVERY_URL}
            className="w-full max-w-sm sm:w-auto justify-center"
          />
        </div>
      </div>
    </section>
  );
}
