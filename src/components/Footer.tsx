import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="relative px-6 md:px-10 pt-16 pb-8 border-t border-hairline">
      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <div className="md:col-span-5">
          <div className="font-display text-3xl md:text-5xl tracking-[-0.035em] leading-[0.95] max-w-md">
            Halton<span className="text-ink-soft">/Works.</span>
            <br />Built quietly.
          </div>
        </div>
        <div className="md:col-span-3 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft flex flex-col gap-2">
          <div className="text-ink mb-2">Offices</div>
          <div>Manchester · UK</div>
        </div>
        <div className="md:col-span-2 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft flex flex-col gap-2">
          <div className="text-ink mb-2">Contact</div>
          <a href="mailto:enquiry@haltonworks.com" className="hover:text-ink transition-colors">enquiry@haltonworks.com</a>
        </div>
        <div className="md:col-span-2 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft flex flex-col gap-2">
          <div className="text-ink mb-2">Index</div>
          <a href="#thesis" className="hover:text-ink transition-colors">Thesis</a>
          <a href="#stack" className="hover:text-ink transition-colors">Stack</a>
          <a href="#engagements" className="hover:text-ink transition-colors">Fit</a>
        </div>
      </div>

      <div className="font-display text-[clamp(4rem,18vw,18rem)] leading-none tracking-[-0.05em] -mb-4 select-none">
        HALTON
      </div>

      <div className="flex flex-col gap-4 pt-6 border-t border-hairline font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/privacy" className="hover:text-ink transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-ink transition-colors">
            Terms of Use
          </Link>
          <Link to="/cookies" className="hover:text-ink transition-colors">
            Cookies
          </Link>
        </div>
        <div className="flex flex-col md:flex-row justify-between gap-3">
          <div>© MMXXVI · Halton Works AG</div>
          <div>All systems nominal · v2.6.1</div>
        </div>
      </div>
    </footer>
  );
}
