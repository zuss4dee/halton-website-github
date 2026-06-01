import { createFileRoute } from "@tanstack/react-router";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Ticker } from "@/components/Ticker";
import { Thesis } from "@/components/Thesis";
import { Stack } from "@/components/Stack";
import { Diagram } from "@/components/Diagram";
import { Engagements } from "@/components/Engagements";
import { Principles } from "@/components/Principles";
import { Apply } from "@/components/Apply";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Halton/Works — Invisible Revenue Infrastructure" },
      {
        name: "description",
        content:
          "A private growth engineering practice. We architect the silent systems behind compounding revenue — pipelines, signals, and automation.",
      },
      { property: "og:title", content: "Halton/Works — Invisible Revenue Infrastructure" },
      {
        property: "og:description",
        content:
          "A private growth engineering practice. Six engagements a year. By referral.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="bg-paper text-ink overflow-x-clip">
      <SmoothScroll />
      <Nav />
      <Hero />
      <Ticker />
      <Thesis />
      <Stack />
      <Diagram />
      <Engagements />
      <Principles />
      <Apply />
      <Footer />
    </main>
  );
}
