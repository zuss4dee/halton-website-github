import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const links = [
  { href: "/#thesis", label: "Thesis" },
  { href: "/#stack", label: "Stack" },
  { href: "/#engagements", label: "Fit" },
  { href: "/#index", label: "Index" },
  { href: "/#apply", label: "Apply" },
] as const;

type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const [mounted, setMounted] = useState(false);

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
            className="fixed inset-0 z-[100] bg-ink/30 md:hidden"
            onClick={close}
          />
          <motion.nav
            id="mobile-nav-panel"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
            className="fixed right-0 top-[4.75rem] bottom-0 z-[101] flex w-[min(15.5rem,calc(100vw-2.5rem))] flex-col pointer-events-none border-l border-hairline md:hidden"
            aria-label="Mobile"
          >
            <div className="pointer-events-auto flex shrink-0 items-center border-b border-hairline bg-paper px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Menu
              </span>
            </div>

            <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto bg-paper px-4 pb-10 pt-2 text-ink">
              <ul className="flex flex-col gap-0 border-t border-hairline">
                {links.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + i * 0.04, duration: 0.3 }}
                    className="border-b border-hairline"
                  >
                    <a
                      href={link.href}
                      onClick={close}
                      className="flex min-h-[52px] items-center font-mono text-[13px] tracking-[0.18em] uppercase text-ink active:opacity-60"
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
                onClick={close}
                className="cta cta--compact mt-8 inline-flex w-fit"
              >
                <span className="dot" />
                <span>See If You Qualify</span>
              </a>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => onOpenChange(!open)}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center text-ink touch-target"
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

      {mounted && createPortal(menu, document.body)}
    </div>
  );
}
