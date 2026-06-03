import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import { CtaButton } from "./CtaButton";
import { HeroPipelineVisual } from "./HeroPipelineVisual";

const word: Variants = {
  hidden: { y: "110%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: 1.1, delay: 0.15 + i * 0.08, ease: [0.77, 0, 0.175, 1] as const },
  }),
};

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      id="top"
      ref={ref}
      className="relative min-h-[100dvh] flex flex-col justify-between pt-28 pb-8 px-5 sm:px-6 md:pt-32 md:pb-10 md:px-10"
    >
      <div className="absolute inset-0 grid-bg opacity-[0.6] pointer-events-none" />
      <div className="absolute inset-x-0 top-24 h-px hairline" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="eyebrow">
          <span className="inline-block w-2 h-2 bg-ink mr-2 -mb-[1px]" />
          Index 001 / Growth Infrastructure
        </div>
        <div className="eyebrow md:hidden max-w-[28ch]">
          A private practice for category-defining operators
        </div>
        <div className="eyebrow hidden md:block max-w-[18ch] text-right">
          A private practice for category-defining operators
        </div>
      </motion.div>

      <motion.div style={{ y, opacity }} className="relative">
        <div className="grid md:grid-cols-12 md:gap-8 items-end">
          <div className="md:col-span-7">
            <h1 className="font-display hero-headline leading-[0.88] sm:leading-[0.86] tracking-[-0.045em] text-balance">
              {["We book.", "You close."].map((w, i) => (
                <span key={i} className="block overflow-hidden">
                  <motion.span variants={word} initial="hidden" animate="show" custom={i} className="block">
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>
          </div>
          <div className="hidden md:block md:col-span-5 md:col-start-8 pb-4">
            <HeroPipelineVisual />
          </div>
        </div>

        <div className="mt-8 md:hidden">
          <HeroPipelineVisual compact />
        </div>

        <div className="mt-8 md:mt-10 flex flex-col gap-8 md:grid md:grid-cols-12 md:gap-6 md:items-end">
          <div className="md:col-span-5 md:col-start-1">
            <p className="text-[15px] sm:text-base md:text-lg text-ink-soft max-w-md leading-relaxed">
              Done-for-you outbound that puts qualified buyers on your calendar. You only talk to people ready to buy.
            </p>
          </div>
          <div className="md:col-span-4 md:col-start-9 flex md:justify-end w-full sm:w-auto">
            <CtaButton label="See If You Qualify" className="w-full sm:w-auto justify-center sm:justify-start" />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="relative mt-12 md:mt-16 grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-6 md:grid-cols-4 font-mono text-[10px] sm:text-[11px] tracking-[0.16em] uppercase text-ink-soft"
      >
        <div>
          <div className="text-ink mb-2">EST. MMXX</div>
          <div>Manchester · UK</div>
        </div>
        <div>
          <div className="text-ink mb-2">Partners / quarter</div>
          <div>3 · capped intake</div>
        </div>
        <div>
          <div className="text-ink mb-2">Show rate</div>
          <div>78% · qualified</div>
        </div>
        <div>
          <div className="text-ink mb-2">Focus</div>
          <div>High-ticket B2B · UK</div>
        </div>
      </motion.div>
    </section>
  );
}
