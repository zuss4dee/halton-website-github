import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

type NavLinkProps = {
  to: string;
  label: string;
  index: number;
  solid?: boolean;
};

export function NavLink({ to, label, index, solid = false }: NavLinkProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = to === "/" ? pathname === "/" : pathname.startsWith(to);

  const textClass = solid
    ? isActive
      ? "text-ink"
      : "text-zinc-500 hover:text-ink"
    : isActive
      ? "text-white"
      : "text-zinc-400 hover:text-white";

  const lineClass = solid ? "bg-ink" : "bg-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.25 + index * 0.07, ease: [0.77, 0, 0.175, 1] }}
    >
      <Link
        to={to}
        aria-current={isActive ? "page" : undefined}
        className={`group relative inline-flex font-mono text-xs tracking-widest lowercase py-2 transition-colors duration-300 ${textClass}`}
      >
        <motion.span whileHover={{ y: -1 }} transition={{ duration: 0.2 }}>
          {label}
        </motion.span>
        <span
          className={`pointer-events-none absolute -bottom-0.5 left-0 h-px w-full origin-left transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] ${lineClass} ${
            isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
          }`}
          aria-hidden
        />
      </Link>
    </motion.div>
  );
}
