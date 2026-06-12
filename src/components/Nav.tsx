import { Link } from "@tanstack/react-router";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";
import { CtaButton } from "./CtaButton";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { CAL_DISCOVERY_URL, MARKETING_NAV } from "@/lib/siteLinks";

export function Nav() {
  const [time, setTime] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 48);
  });

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
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,backdrop-filter,box-shadow] duration-500 ${
        mobileOpen ? "max-md:z-[110]" : ""
      } ${
        scrolled
          ? "bg-paper/95 backdrop-blur-md border-b border-hairline shadow-[0_8px_32px_rgb(0_0_0/0.04)] md:mix-blend-normal"
          : "bg-paper/90 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:mix-blend-difference"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:gap-4 md:px-10 md:py-6 transition-colors duration-500 ${
          scrolled ? "text-ink" : "text-ink md:text-paper"
        }`}
      >
        <Link to="/" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 touch-target sm:flex-none">
          <motion.svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            className="shrink-0"
            aria-hidden
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.5, ease: [0.77, 0, 0.175, 1] }}
          >
            <rect x="0.5" y="0.5" width="21" height="21" stroke="currentColor" />
            <rect x="5" y="5" width="12" height="12" fill="currentColor" />
          </motion.svg>
          <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase truncate">
            Halton&nbsp;/&nbsp;Works
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-10" aria-label="Primary">
          {MARKETING_NAV.map((link, i) => (
            <NavLink key={link.to} to={link.to} label={link.label} index={i} solid={scrolled} />
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase hidden xl:block tabular-nums opacity-70">
            {time || "00:00:00 UTC"}
          </div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: [0.77, 0, 0.175, 1] }}
            className="nav-cta-wrap mix-blend-normal"
          >
            <CtaButton
              label="Book an Audit"
              href={CAL_DISCOVERY_URL}
              className="hidden md:inline-flex cta--nav"
              animateEntrance
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: [0.77, 0, 0.175, 1] }}
            className="md:hidden nav-cta-wrap mix-blend-normal"
          >
            <CtaButton
              label="Audit"
              href={CAL_DISCOVERY_URL}
              className="cta--nav-mobile"
              animateEntrance
            />
          </motion.div>

          <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} scrolled={scrolled} />
        </div>
      </div>
    </motion.header>
  );
}
