import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Halton/Works" },
      {
        name: "description",
        content: "How Halton Works uses cookies and similar technologies on haltonworks.com.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalPageLayout eyebrow="Legal / Cookies" title="Cookie Policy" updated="3 June 2026">
      <LegalSection n="1" title="Overview">
        <p>
          This policy explains how Halton Works AG uses cookies and similar technologies on haltonworks.com. For how we
          handle personal data more broadly, see our{" "}
          <Link to="/privacy" className="text-ink hover:opacity-70 transition-opacity">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection n="2" title="What cookies are">
        <p>
          Cookies are small text files stored on your device when you visit a website. Similar technologies include
          local storage, pixels, and SDK identifiers used for analytics or embedded content.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Cookies we may use">
        <p>Depending on how the site is configured, we may use:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink font-normal">Strictly necessary</strong> cookies required for security, load
            balancing, or basic site function. These do not require consent under UK PECR.
          </li>
          <li>
            <strong className="text-ink font-normal">Analytics</strong> cookies to understand traffic and page
            performance (for example aggregated visit counts or referrers), where enabled.
          </li>
          <li>
            <strong className="text-ink font-normal">Functional</strong> cookies that remember preferences if we offer
            them.
          </li>
        </ul>
        <p>
          Our marketing site is largely static. If we add analytics or similar tools, we will update this page and,
          where required, ask for consent before non-essential cookies are set.
        </p>
      </LegalSection>

      <LegalSection n="4" title="Third-party services">
        <p>
          When you click through to external services, their cookies may apply on their domain. For example, our
          qualification form is hosted on Tally (tally.so). Tally&apos;s own cookie and privacy practices apply on
          their pages. Review their documentation before submitting personal data there.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Managing cookies">
        <p>
          You can block or delete cookies through your browser settings. Blocking all cookies may affect how some sites
          work. For industry guidance on online privacy in the UK, visit the ICO at{" "}
          <a
            href="https://ico.org.uk"
            className="text-ink hover:opacity-70 transition-opacity"
            target="_blank"
            rel="noopener noreferrer"
          >
            ico.org.uk
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection n="6" title="Updates">
        <p>
          We may update this policy when our site or tooling changes. Check the date at the top of the page for the
          latest version.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
