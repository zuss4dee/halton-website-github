import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
};

export function LegalPageLayout({ eyebrow, title, updated, children }: LegalPageLayoutProps) {
  return (
    <main className="bg-paper text-ink min-h-screen overflow-x-clip">
      <Nav />
      <article className="px-5 sm:px-6 md:px-10 pt-28 sm:pt-32 md:pt-40 pb-16 sm:pb-20 md:pb-28">
        <div className="max-w-4xl">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-6 sm:mt-8 font-display text-[clamp(2rem,8vw,3.75rem)] md:text-6xl leading-[0.95] tracking-[-0.035em] text-balance">
            {title}
          </h1>
          <p className="mt-6 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
            Last updated · {updated}
          </p>
          <div className="mt-16 md:mt-20">{children}</div>
        </div>
      </article>
      <Footer />
    </main>
  );
}
