import { createFileRoute } from "@tanstack/react-router";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ConsultingHero } from "@/components/consulting/ConsultingHero";
import { ConsultingScope } from "@/components/consulting/ConsultingScope";
import { ConsultingProcess } from "@/components/consulting/ConsultingProcess";
import { ConsultingFit } from "@/components/consulting/ConsultingFit";
import { ConsultingCta } from "@/components/consulting/ConsultingCta";

export const Route = createFileRoute("/consulting")({
  head: () => ({
    meta: [
      { title: "Operations Consulting — Halton/Works" },
      {
        name: "description",
        content:
          "Kill the overhead. Permanent closed-loop AI infrastructure that runs your backend on pure code.",
      },
      { property: "og:title", content: "Operations Consulting — Halton/Works" },
      {
        property: "og:description",
        content: "Kill the overhead. Operations consulting from Halton Works.",
      },
    ],
  }),
  component: ConsultingPage,
});

function ConsultingPage() {
  return (
    <main className="bg-paper text-ink overflow-x-clip">
      <SmoothScroll />
      <Nav />
      <ConsultingHero />
      <ConsultingScope />
      <ConsultingProcess />
      <ConsultingFit />
      <ConsultingCta />
      <Footer />
    </main>
  );
}
