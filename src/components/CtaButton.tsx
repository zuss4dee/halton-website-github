import { motion } from "framer-motion";
import { useState } from "react";

export function CtaButton({ label = "See If You Qualify" }: { label?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.a
      href="https://tally.so/r/QKO5j1"
      target="_blank"
      rel="noopener noreferrer"
      className="cta group"
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileTap={{ scale: 0.98 }}
    >
      <span className="dot" />
      <span>{label}</span>
      <motion.svg
        width="14"
        height="10"
        viewBox="0 0 14 10"
        animate={{ x: hover ? 4 : 0 }}
        transition={{ duration: 0.4, ease: [0.77, 0, 0.175, 1] }}
      >
        <path d="M0 5h12M8 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </motion.svg>
    </motion.a>
  );
}
