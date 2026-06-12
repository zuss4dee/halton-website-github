import { motion } from "framer-motion";
import { useState } from "react";

type CtaButtonProps = {
  label?: string;
  className?: string;
  href?: string;
  animateEntrance?: boolean;
};

export function CtaButton({
  label = "See If You Qualify",
  className = "",
  href = "https://tally.so/r/QKO5j1",
  animateEntrance = false,
}: CtaButtonProps) {
  const [hover, setHover] = useState(false);

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`cta group touch-target ${className}`.trim()}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      initial={animateEntrance ? { opacity: 0, y: 6 } : false}
      animate={animateEntrance ? { opacity: 1, y: 0 } : undefined}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
    >
      <motion.span
        className="dot"
        animate={hover ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <span>{label}</span>
      <motion.svg
        width="14"
        height="10"
        viewBox="0 0 14 10"
        animate={{ x: hover ? 5 : 0, opacity: hover ? 1 : 0.85 }}
        transition={{ duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
        aria-hidden
      >
        <path d="M0 5h12M8 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </motion.svg>
    </motion.a>
  );
}
