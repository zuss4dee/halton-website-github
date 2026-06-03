import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Halton/Works" },
      {
        name: "description",
        content:
          "Terms governing use of the Halton Works website and our done-for-you B2B outbound and meeting booking services.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPageLayout eyebrow="Legal / Terms" title="Terms of Use" updated="3 June 2026">
      <LegalSection n="1" title="Agreement">
        <p>
          These Terms of Use (&quot;Terms&quot;) apply to your use of haltonworks.com and to enquiries about Halton
          Works AG&apos;s services. By using the site or submitting an application, you agree to these Terms. A
          separate written or signed client agreement will govern paid engagements where it conflicts with these Terms
          on service delivery.
        </p>
      </LegalSection>

      <LegalSection n="2" title="What we provide">
        <p>
          Halton Works is a done-for-you B2B outbound service based in Manchester, UK. We design and run outbound
          campaigns on behalf of qualified clients with the goal of booking qualified sales meetings on your calendar.
          We are not a self-serve software product, and we do not guarantee a specific number of meetings, revenue, or
          close rate unless expressly agreed in writing.
        </p>
      </LegalSection>

      <LegalSection n="3" title="Website use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Use the site in any unlawful way or to transmit malware or abusive content.</li>
          <li>Attempt unauthorised access to our systems, client areas, or third-party services we use.</li>
          <li>Copy, scrape, or republish site content for commercial use without our permission.</li>
        </ul>
        <p>We may suspend access if we reasonably believe these Terms are breached.</p>
      </LegalSection>

      <LegalSection n="4" title="Applications and partner capacity">
        <p>
          Applications submitted through our site or Tally forms are invitations to assess fit, not a binding offer of
          service. We cap active partners (for example three per quarter) so we can deliver properly. Acceptance,
          scope, fees, and timelines are confirmed only after mutual agreement and, where applicable, signature of a
          client agreement.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Client responsibilities">
        <p>If you become a client, you agree to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide accurate ICP, positioning, and compliance information we need to run campaigns.</li>
          <li>Maintain lawful rights to contact prospect data you supply or approve for outreach.</li>
          <li>Respond to booked meetings professionally and keep calendar availability accurate.</li>
          <li>Review and approve messaging, offers, and sending domains where we require client sign-off.</li>
          <li>Pay agreed fees on time and notify us of material changes to your business or offer.</li>
        </ul>
      </LegalSection>

      <LegalSection n="6" title="Compliance and outreach standards">
        <p>
          Clients remain responsible for the lawfulness of their offers and lists. We run B2B outreach in line with
          agreed playbooks and industry standards, including respect for opt-out requests and applicable rules such as
          UK PECR and GDPR. You must not ask us to send deceptive, unlawful, or harassing communications.
        </p>
      </LegalSection>

      <LegalSection n="7" title="Fees and payment">
        <p>
          Pricing, payment schedules, and any performance-related terms are set out in your client agreement. Unless
          stated otherwise, fees are exclusive of VAT and non-refundable once work for a billing period has started,
          except where required by law or expressly agreed in writing.
        </p>
      </LegalSection>

      <LegalSection n="8" title="No guarantees">
        <p>
          Outbound results depend on market conditions, offer strength, sales execution, and factors outside our
          control. Except where explicitly stated in a signed agreement, we do not warrant specific pipeline value,
          revenue, ROI, or hiring outcomes. Testimonials or examples on the site illustrate past experience, not a
          promise of future results.
        </p>
      </LegalSection>

      <LegalSection n="9" title="Confidentiality">
        <p>
          Each party will treat non-public business information shared during engagement as confidential and use it
          only to perform the services, except where disclosure is required by law or already public without breach.
        </p>
      </LegalSection>

      <LegalSection n="10" title="Intellectual property">
        <p>
          We retain ownership of our methodologies, templates, systems, and brand assets. You retain ownership of your
          brand and materials you provide. Upon full payment, you receive the rights agreed in your client agreement to
          deliverables created specifically for you (for example approved copy or campaign assets), subject to our
          retained background IP.
        </p>
      </LegalSection>

      <LegalSection n="11" title="Limitation of liability">
        <p>
          Nothing in these Terms excludes liability that cannot be excluded under English law. Subject to that, we are
          not liable for indirect or consequential loss, loss of profit, or loss of opportunity arising from site use or
          services, and our total liability for any claim relating to a given engagement is limited to the fees paid
          for that engagement in the twelve months before the claim, unless your client agreement states otherwise.
        </p>
      </LegalSection>

      <LegalSection n="12" title="Termination">
        <p>
          Either party may end an engagement as set out in the client agreement. We may pause or terminate campaigns
          immediately if fees are overdue, compliance instructions are ignored, or we reasonably believe continued work
          creates legal or reputational risk.
        </p>
      </LegalSection>

      <LegalSection n="13" title="Governing law">
        <p>
          These Terms are governed by the laws of England and Wales. Courts in England and Wales have exclusive
          jurisdiction, without prejudice to mandatory consumer rights where applicable.
        </p>
      </LegalSection>

      <LegalSection n="14" title="Contact">
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:enquiry@haltonworks.com" className="text-ink hover:opacity-70 transition-opacity">
            enquiry@haltonworks.com
          </a>
          . See also our{" "}
          <Link to="/privacy" className="text-ink hover:opacity-70 transition-opacity">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/cookies" className="text-ink hover:opacity-70 transition-opacity">
            Cookie Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
