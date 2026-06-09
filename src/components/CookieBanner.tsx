import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "halton-cookie-consent";

type ConsentChoice = "accepted" | "declined";

function isPublicMarketingPath(pathname: string): boolean {
  return !pathname.startsWith("/admin") && !pathname.startsWith("/workspace");
}

export function CookieBanner() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setIsVisible(!stored);
    setHasCheckedStorage(true);
  }, []);

  const persistChoice = useCallback((choice: ConsentChoice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setIsVisible(false);
  }, []);

  const showBanner = hasCheckedStorage && isVisible && isPublicMarketingPath(pathname);

  return (
    <AnimatePresence>
      {showBanner ? (
        <motion.aside
          role="dialog"
          aria-label="Cookie consent"
          aria-live="polite"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed bottom-4 left-4 right-4 z-50 max-w-sm sm:bottom-6 sm:left-auto sm:right-6 bg-slate-900/90 backdrop-blur-md text-slate-200 border border-slate-800 p-4 rounded-xl shadow-2xl"
        >
          <p className="text-sm leading-relaxed text-slate-300">
            We use cookies to optimize your experience and analyze our traffic. Read our{" "}
            <Link
              to="/privacy"
              className="text-slate-100 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-white hover:decoration-slate-400"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => persistChoice("accepted")}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-white"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={() => persistChoice("declined")}
              className="rounded-lg border border-slate-700/80 bg-transparent px-4 py-2 text-sm text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:border-slate-600 hover:text-slate-200"
            >
              Essential Only
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
