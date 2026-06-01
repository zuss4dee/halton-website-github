import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Nav() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        hour12: false,
      }).format(new Date()) + " UTC";
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.77, 0, 0.175, 1] }}
      className="fixed top-0 left-0 right-0 z-50 mix-blend-difference"
    >
      <div className="flex items-center justify-between px-6 md:px-10 py-6 text-paper">
        <a href="#top" className="flex items-center gap-3 text-paper">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-paper">
            <rect x="0.5" y="0.5" width="21" height="21" stroke="currentColor" />
            <rect x="5" y="5" width="12" height="12" fill="currentColor" />
          </svg>
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-paper">
            Halton&nbsp;/&nbsp;Works
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-10 font-mono text-[11px] tracking-[0.18em] uppercase text-paper">
          <a href="#thesis" className="hover:opacity-60 transition-opacity">Thesis</a>
          <a href="#stack" className="hover:opacity-60 transition-opacity">Stack</a>
          <a href="#engagements" className="hover:opacity-60 transition-opacity">Engagements</a>
          <a href="#index" className="hover:opacity-60 transition-opacity">Index</a>
        </nav>

        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-paper hidden sm:block">
          {time || "—— UTC"}
        </div>
      </div>
    </motion.header>
  );
}
