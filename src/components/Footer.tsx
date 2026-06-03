import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="relative px-5 sm:px-6 md:px-10 pt-12 sm:pt-16 pb-8 border-t border-hairline overflow-x-clip">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 md:gap-10 mb-12 md:mb-16">
        <div className="sm:col-span-2 md:col-span-5">
          <div className="font-display text-2xl sm:text-3xl md:text-5xl tracking-[-0.035em] leading-[0.95] max-w-md">
            Halton<span className="text-ink-soft">/Works.</span>
            <br />Built quietly.
          </div>
        </div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft flex flex-col gap-2 md:col-span-3">
          <div className="text-ink mb-1 md:mb-2">Offices</div>
          <div>Manchester · UK</div>
        </div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft flex flex-col gap-2 md:col-span-2">
          <div className="text-ink mb-1 md:mb-2">Contact</div>
          <a
            href="mailto:enquiry@haltonworks.com"
            className="hover:text-ink transition-colors inline-flex min-h-11 items-center break-all sm:break-normal"
          >
            enquiry@haltonworks.com
          </a>
        </div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft flex flex-col gap-1 sm:gap-2 md:col-span-2">
          <div className="text-ink mb-1 md:mb-2">Index</div>
          <a href="#thesis" className="hover:text-ink transition-colors inline-flex min-h-11 items-center">
            Thesis
          </a>
          <a href="#stack" className="hover:text-ink transition-colors inline-flex min-h-11 items-center">
            Stack
          </a>
          <a href="#engagements" className="hover:text-ink transition-colors inline-flex min-h-11 items-center">
            Fit
          </a>
        </div>
      </div>

      <div className="font-display text-[clamp(2.75rem,16vw,18rem)] leading-none tracking-[-0.05em] -mb-2 sm:-mb-4 select-none overflow-hidden">
        HALTON
      </div>

      <div className="flex flex-col gap-4 pt-6 border-t border-hairline font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-ink-soft">
        <div className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-1">
          <Link to="/privacy" className="hover:text-ink transition-colors inline-flex min-h-11 items-center">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-ink transition-colors inline-flex min-h-11 items-center">
            Terms of Use
          </Link>
          <Link to="/cookies" className="hover:text-ink transition-colors inline-flex min-h-11 items-center">
            Cookies
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3">
          <div>© MMXXVI · Halton Works AG</div>
          <div>All systems nominal · v2.6.1</div>
        </div>
      </div>
    </footer>
  );
}
