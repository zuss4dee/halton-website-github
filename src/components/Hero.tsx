import { motion, useScroll, useTransform, animate, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CtaButton } from "./CtaButton";
import { HeroPipelineVisual } from "./HeroPipelineVisual";

const word: Variants = {
  hidden: { y: "110%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: 1.1, delay: 0.15 + i * 0.08, ease: [0.77, 0, 0.175, 1] as const },
  }),
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function AnimatedStat({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, target, {
      duration: 1.6,
      delay: 1.3,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return controls.stop;
  }, [target]);

  return (
    <>
      {value}
      {suffix}
    </>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-0 flex-col justify-start gap-4 pt-[4.75rem] pb-8 px-5 sm:px-6 md:min-h-[100dvh] md:gap-0 md:pt-28 md:pb-10 md:px-10"
    >
      <div className="absolute inset-0 grid-bg opacity-[0.6] pointer-events-none" />
      <div className="absolute inset-x-0 top-[4.75rem] md:top-24 h-px hairline" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="relative flex shrink-0 flex-col gap-3 pt-3 sm:flex-row sm:items-start sm:justify-between md:pt-0"
      >
        <div className="eyebrow">
          <motion.span
            className="mr-2 -mb-[1px] inline-block h-2 w-2 bg-ink"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          Index 001 / Growth Infrastructure
        </div>
        <div className="eyebrow md:hidden max-w-[28ch]">
          A private practice for category-defining operators
        </div>
        <div className="eyebrow hidden md:block max-w-[18ch] text-right">
          A private practice for category-defining operators
        </div>
      </motion.div>

      <div className="relative flex flex-1 flex-col md:justify-center md:py-6">
        <motion.div style={{ y, opacity }} className="relative mt-6 md:mt-0">
          <div className="grid items-end gap-8 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7">
              <h1 className="font-display hero-headline text-balance leading-[0.88] tracking-[-0.045em] sm:leading-[0.86]">
                {["We book.", "You close."].map((w, i) => (
                  <span key={i} className="block overflow-hidden">
                    <motion.span variants={word} initial="hidden" animate="show" custom={i} className="block">
                      {w}
                      {i === 1 && (
                        <motion.span
                          className="ml-[0.06em] hidden md:inline-block h-[0.72em] w-[0.07em] translate-y-[0.04em] bg-ink align-middle"
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                          aria-hidden
                        />
                      )}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0.75}
                className="mt-6 md:mt-8 md:max-w-lg"
              >
                <div className="relative border-l border-hairline pl-4 md:pl-5">
                  <motion.div
                    className="absolute left-0 top-0 w-px bg-ink"
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 1.1, delay: 0.95, ease: [0.77, 0, 0.175, 1] }}
                  />
                  <p className="text-[15px] leading-relaxed text-ink-soft sm:text-base md:text-lg">
                    Done-for-you outbound that puts qualified buyers on your calendar. You only talk to people ready to
                    buy.
                  </p>
                </div>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0.95}
                className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 md:mt-8"
              >
                <CtaButton label="See If You Qualify" className="cta--hero w-full sm:w-auto justify-center sm:justify-start" />
                <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
                  <motion.span
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="text-ink"
                  >
                    3 slots
                  </motion.span>
                  {" · "}
                  78% show rate · UK B2B
                </p>
              </motion.div>
            </div>

            <div className="hidden md:block md:col-span-5 md:col-start-8">
              <HeroPipelineVisual />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="relative mt-8 grid shrink-0 grid-cols-2 gap-x-4 gap-y-6 pt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:gap-6 md:mt-auto md:grid-cols-4 md:pt-0 sm:text-[11px]"
      >
        <div>
          <div className="mb-2 text-ink">EST. MMXX</div>
          <div>Manchester · UK</div>
        </div>
        <div>
          <div className="mb-2 text-ink">Partners / quarter</div>
          <div>
            <AnimatedStat target={3} suffix=" · capped intake" />
          </div>
        </div>
        <div>
          <div className="mb-2 text-ink">Show rate</div>
          <div>
            <AnimatedStat target={78} suffix="% · qualified" />
          </div>
        </div>
        <div>
          <div className="mb-2 text-ink">Focus</div>
          <div>High-ticket B2B · UK</div>
        </div>
      </motion.div>
    </section>
  );
}
