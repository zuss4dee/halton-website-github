import type { ReactNode } from "react";

type LegalSectionProps = {
  n: string;
  title: string;
  children: ReactNode;
};

export function LegalSection({ n, title, children }: LegalSectionProps) {
  return (
    <section className="py-10 md:py-12 border-t border-hairline first:border-t-0 first:pt-0">
      <h2 className="font-display text-2xl md:text-3xl leading-[1.05] tracking-[-0.03em] text-ink">
        {n}. {title}
      </h2>
      <div className="mt-6 text-base text-ink-soft leading-relaxed max-w-3xl space-y-4">
        {children}
      </div>
    </section>
  );
}
