import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Halton/Works" },
      {
        name: "description",
        content:
          "How Halton Works collects and uses personal data for our done-for-you B2B outbound service in Manchester, UK.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPageLayout eyebrow="Legal / Privacy" title="Privacy Policy" updated="3 June 2026">
      <LegalSection n="1" title="Who we are">
        <p>
          Halton Works AG (&quot;Halton Works&quot;, &quot;we&quot;, &quot;us&quot;) provides done-for-you B2B
          outbound and meeting booking services from Manchester, United Kingdom. This policy explains how we handle
          personal data when you visit haltonworks.com, enquire about our services, or work with us as a client.
        </p>
        <p>
          For privacy questions or requests, contact{" "}
          <a href="mailto:enquiry@haltonworks.com" className="text-ink hover:opacity-70 transition-opacity">
            enquiry@haltonworks.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection n="2" title="Data we collect">
        <p>Depending on how you interact with us, we may collect:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink font-normal">Enquiry and application data</strong> such as name, work email,
            company, role, website, and answers you submit through our contact or qualification forms (including forms
            hosted on Tally).
          </li>
          <li>
            <strong className="text-ink font-normal">Communications</strong> including email correspondence with our
            team and notes from discovery or onboarding calls.
          </li>
          <li>
            <strong className="text-ink font-normal">Client account data</strong> needed to deliver outbound on your
            behalf, such as ICP definitions, approved messaging, CRM fields, and calendar booking details.
          </li>
          <li>
            <strong className="text-ink font-normal">Prospect and lead data</strong> that you provide or that we process
            when running campaigns for you (for example business contact details of target accounts).
          </li>
          <li>
            <strong className="text-ink font-normal">Technical data</strong> such as IP address, browser type, device
            information, and usage data if analytics or similar tools are enabled on the website.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n="3" title="How we use your data">
        <p>We use personal data to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Respond to enquiries and assess fit for our partner programme.</li>
          <li>Onboard clients, deliver outbound campaigns, and book qualified meetings on your calendar.</li>
          <li>Operate, secure, and improve our website and internal workflows.</li>
          <li>Meet legal, accounting, and regulatory obligations.</li>
          <li>Send service-related updates where you are an active client or have asked to hear from us.</li>
        </ul>
        <p>We do not sell personal data.</p>
      </LegalSection>

      <LegalSection n="4" title="Lawful bases (UK GDPR)">
        <p>Where UK GDPR applies, we rely on one or more of the following lawful bases:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-ink font-normal">Contract</strong> to perform our services or take steps at your
            request before entering a contract.
          </li>
          <li>
            <strong className="text-ink font-normal">Legitimate interests</strong> to operate and grow our business,
            secure our systems, and run proportionate B2B outreach, balanced against your rights.
          </li>
          <li>
            <strong className="text-ink font-normal">Consent</strong> where required, for example certain marketing
            cookies or optional communications.
          </li>
          <li>
            <strong className="text-ink font-normal">Legal obligation</strong> where we must retain or disclose
            information by law.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n="5" title="Outbound on behalf of clients">
        <p>
          When you engage Halton Works, we often act under your direction to contact business prospects on your behalf.
          You are responsible for ensuring you have an appropriate lawful basis and that your lists, offers, and
          instructions comply with applicable law (including UK GDPR, PECR, and CAN-SPAM where relevant).
        </p>
        <p>
          Where we process prospect data only to deliver your campaign, we typically act as a processor and will
          handle that data according to our client agreement and your documented instructions.
        </p>
      </LegalSection>

      <LegalSection n="6" title="Sharing and processors">
        <p>We may share data with trusted providers who help us run the business, such as:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Form providers (for example Tally) for applications and enquiries.</li>
          <li>Email, calendar, CRM, and infrastructure tools used to deliver outbound.</li>
          <li>Hosting, analytics, or security vendors where enabled on the site.</li>
          <li>Professional advisers (legal, accounting) when required.</li>
        </ul>
        <p>
          We require appropriate safeguards from processors and only share what is needed for the stated purpose.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Retention">
        <p>
          We keep personal data only as long as needed for the purposes above, including active client relationships,
          dispute resolution, and legal retention periods. Enquiry data that does not progress to a client engagement
          is routinely reviewed and deleted or anonymised when no longer needed.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Security">
        <p>
          We apply reasonable technical and organisational measures to protect personal data, including access
          controls and least-privilege practices for client workspaces. No online service can be guaranteed completely
          secure; please use strong credentials and notify us promptly of any suspected incident.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Your rights">
        <p>
          If UK GDPR applies, you may have rights to access, rectify, erase, restrict processing, object, and data
          portability, and to withdraw consent where processing is consent-based. You may also lodge a complaint with
          the Information Commissioner&apos;s Office (ICO) at{" "}
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
        <p>
          To exercise your rights, email{" "}
          <a href="mailto:enquiry@haltonworks.com" className="text-ink hover:opacity-70 transition-opacity">
            enquiry@haltonworks.com
          </a>
          . We may need to verify your identity before responding.
        </p>
      </LegalSection>

      <LegalSection n="10" title="International transfers">
        <p>
          Our operations are based in the United Kingdom. If we transfer personal data outside the UK, we use
          appropriate safeguards such as UK International Data Transfer Agreements or adequacy regulations, unless an
          exemption applies.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Changes to this policy">
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date at the top of the page will
          change when we do. Material changes for active clients will be communicated where appropriate.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
