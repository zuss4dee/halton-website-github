import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CtaButton } from "./CtaButton";
import { CAL_DISCOVERY_URL, MARKETING_NAV } from "@/lib/siteLinks";

type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scrolled?: boolean;
};

export function MobileNav({ open, onOpenChange, scrolled = false }: MobileNavProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const close = () => onOpenChange(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const menu = (
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
            className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-[2px] md:hidden"
            onClick={close}
          />
          <motion.nav
            id="mobile-nav-panel"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.45, ease: [0.77, 0, 0.175, 1] }}
            className="fixed right-0 top-0 bottom-0 z-[101] flex w-[min(18rem,calc(100vw-2rem))] flex-col pointer-events-none border-l border-hairline md:hidden shadow-[-16px_0_48px_rgb(0_0_0/0.08)]"
            aria-label="Mobile"
          >
            <div className="pointer-events-auto flex shrink-0 items-center justify-between border-b border-hairline bg-paper px-5 py-4 pt-[4.75rem]">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">Navigate</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="font-mono text-[10px] tracking-widest lowercase text-zinc-500 hover:text-ink transition-colors"
              >
                close
              </button>
            </div>

            <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto bg-paper px-5 pb-10 pt-4 text-ink">
              <ul className="flex flex-col gap-0 border-t border-hairline">
                {MARKETING_NAV.map((link, i) => {
                  const isActive = link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);
                  return (
                    <motion.li
                      key={link.to}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.06, duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
                      className="border-b border-hairline"
                    >
                      <Link
                        to={link.to}
                        onClick={close}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex min-h-[56px] items-center font-mono text-sm tracking-widest lowercase transition-colors duration-300 ${
                          isActive ? "text-ink" : "text-zinc-500 hover:text-ink"
                        }`}
                      >
                        {link.label}
                        <span
                          className={`absolute bottom-0 left-0 h-px bg-ink transition-all duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] ${
                            isActive ? "w-full" : "w-0 group-hover:w-full"
                          }`}
                          aria-hidden
                        />
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.4, ease: [0.77, 0, 0.175, 1] }}
                className="mt-8"
              >
                <CtaButton
                  label="Book an Audit"
                  href={CAL_DISCOVERY_URL}
                  className="cta--mobile-menu w-full justify-center"
                />
              </motion.div>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="md:hidden">
      <motion.button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => onOpenChange(!open)}
        whileTap={{ scale: 0.94 }}
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center touch-target rounded-sm border transition-colors duration-300 ${
          open || scrolled
            ? "border-hairline bg-paper text-ink"
            : "border-transparent text-ink"
        }`}
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
      </motion.button>

      {mounted && createPortal(menu, document.body)}
    </div>
  );
}
