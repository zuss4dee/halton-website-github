import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const links = [
  { href: "/#thesis", label: "Thesis" },
  { href: "/#stack", label: "Stack" },
  { href: "/#engagements", label: "Fit" },
  { href: "/#index", label: "Index" },
  { href: "/#apply", label: "Apply" },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="relative z-[60] flex h-11 w-11 shrink-0 items-center justify-center text-paper touch-target"
      >
        <span className="sr-only">{open ? "Close" : "Menu"}</span>
        <span className="flex h-3.5 w-5 flex-col justify-between">
          <motion.span
            animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            className="block h-px w-full origin-center bg-current"
            transition={{ duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
          />
          <motion.span
            animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            className="block h-px w-full bg-current"
            transition={{ duration: 0.25 }}
          />
          <motion.span
            animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            className="block h-px w-full origin-center bg-current"
            transition={{ duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
          />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[55] bg-ink/20 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <motion.nav
              id="mobile-nav-panel"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.77, 0, 0.175, 1] }}
              className="fixed inset-x-0 top-0 z-[58] border-b border-hairline bg-paper px-6 pb-8 pt-[5.5rem] text-ink shadow-sm"
            >
              <ul className="flex flex-col gap-1">
                {links.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.04, duration: 0.35 }}
                  >
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center font-mono text-[12px] tracking-[0.18em] uppercase text-ink hover:opacity-60 transition-opacity"
                    >
                      {link.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
              <a
                href="https://tally.so/r/QKO5j1"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="cta mt-6 w-full justify-center touch-target"
              >
                <span className="dot" />
                <span>See If You Qualify</span>
              </a>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
