import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MobileNav } from "./MobileNav";

export function Nav() {
  const [time, setTime] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

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
      className={`fixed top-0 left-0 right-0 z-50 bg-paper/90 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:mix-blend-difference ${
        mobileOpen ? "max-md:z-[110]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4 px-5 sm:px-6 md:px-10 py-5 md:py-6 text-ink md:text-paper">
        <a href="/" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-ink md:text-paper touch-target sm:flex-none">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-ink md:text-paper shrink-0" aria-hidden>
            <rect x="0.5" y="0.5" width="21" height="21" stroke="currentColor" />
            <rect x="5" y="5" width="12" height="12" fill="currentColor" />
          </svg>
          <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-ink md:text-paper truncate">
            Halton&nbsp;/&nbsp;Works
          </span>
        </a>

        <nav
          className="hidden md:flex items-center gap-10 font-mono text-[11px] tracking-[0.18em] uppercase text-paper"
          aria-label="Primary"
        >
          <a href="/#thesis" className="hover:opacity-60 transition-opacity py-2">Thesis</a>
          <a href="/#stack" className="hover:opacity-60 transition-opacity py-2">Stack</a>
          <a href="/#engagements" className="hover:opacity-60 transition-opacity py-2">Fit</a>
          <a href="/#index" className="hover:opacity-60 transition-opacity py-2">Index</a>
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-ink md:text-paper hidden min-[420px]:block tabular-nums">
            {time || "00:00:00 UTC"}
          </div>
          <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
        </div>
      </div>
    </motion.header>
  );
}
