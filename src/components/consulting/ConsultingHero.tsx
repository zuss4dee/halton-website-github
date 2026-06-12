import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { CtaButton } from "@/components/CtaButton";
import { ConsultingHeroVisual } from "@/components/consulting/ConsultingHeroVisual";
import { CAL_DISCOVERY_URL } from "@/lib/siteLinks";
import { useRef } from "react";

const word: Variants = {
  hidden: { y: "110%" },
  show: {
    y: "0%",
    transition: { duration: 1.1, delay: 0.15, ease: [0.77, 0, 0.175, 1] as const },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function ConsultingHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-0 flex-col justify-start pt-[4.75rem] pb-16 px-5 sm:px-6 md:min-h-[92dvh] md:pt-28 md:pb-20 md:px-10"
    >
      <div className="absolute inset-0 grid-bg opacity-[0.6] pointer-events-none" />
      <div className="absolute inset-x-0 top-[4.75rem] md:top-24 h-px hairline" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="relative z-10 flex shrink-0 flex-col gap-3 pt-3 md:pt-0"
      >
        <div className="eyebrow">
          <motion.span
            className="mr-2 -mb-[1px] inline-block h-2 w-2 bg-ink"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          Index 002 / Operations Consulting
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-1 flex-col md:justify-center md:py-10">
        <motion.div style={{ y, opacity }} className="relative mt-8 md:mt-0">
          <div className="grid items-center gap-10 md:grid-cols-12 md:gap-8 md:items-center">
            <div className="md:col-span-7">
              <h1 className="font-display hero-headline text-balance leading-[0.86] tracking-[-0.06em] sm:leading-[0.84] lowercase">
                <span className="block overflow-hidden">
                  <motion.span variants={word} initial="hidden" animate="show" className="block">
                    kill the overhead.
                  </motion.span>
                </span>
              </h1>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0.75}
                className="mt-10 md:mt-14 md:max-w-lg"
              >
                <div className="relative border-l border-hairline pl-4 md:pl-5">
                  <motion.div
                    className="absolute left-0 top-0 w-px bg-ink"
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 1.1, delay: 0.95, ease: [0.77, 0, 0.175, 1] }}
                  />
                  <p className="text-[15px] leading-relaxed text-ink-soft sm:text-base">
                    Stop solving operational friction with expensive salaries. We engineer permanent, closed-loop AI
                    infrastructure that runs your backend on pure code.
                  </p>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.95} className="mt-10 md:mt-14">
                <CtaButton
                  label="Book an Audit"
                  href={CAL_DISCOVERY_URL}
                  className="cta--hero w-full sm:w-auto justify-center sm:justify-start"
                />
              </motion.div>
            </div>

            <div className="md:col-span-5 md:col-start-8 flex justify-center md:justify-end">
              <ConsultingHeroVisual className="w-full max-w-[min(100%,420px)] md:max-w-[480px] lg:max-w-[520px] md:ml-auto" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
