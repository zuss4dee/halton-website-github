import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SecuredMeetingsTable } from "@/components/workspace/SecuredMeetingsTable";
import { WorkspaceSettings } from "@/components/workspace/WorkspaceSettings";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Halton/Works" },
      {
        name: "description",
        content: "Define your ICP and deploy outbound infrastructure.",
      },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const [icp, setIcp] = useState("");

  return (
    <main
      className="workspace-portal min-h-screen bg-white text-black selection:bg-black selection:text-white"
      data-theme="workspace-light"
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-16 md:px-10 md:py-24">
        <div className="mb-10 flex justify-end md:mb-12">
          <WorkspaceSettings />
        </div>

        <header className="text-center">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-black/45">
            Client Workspace
          </p>
          <h1 className="mt-6 font-display text-[clamp(2.25rem,7vw,4.75rem)] leading-[0.92] tracking-[-0.045em] text-balance text-black">
            Define Your Ideal Customer Profile (ICP)
          </h1>
        </header>

        <div className="mt-12 md:mt-16">
          <label htmlFor="icp-definition" className="sr-only">
            Ideal Customer Profile definition
          </label>
          <textarea
            id="icp-definition"
            name="icp"
            value={icp}
            onChange={(e) => setIcp(e.target.value)}
            placeholder="Describe your ideal customer: firmographics, pain points, buying triggers, disqualifiers, and target titles…"
            rows={10}
            className="w-full resize-y border border-black/15 bg-white px-5 py-5 font-sans text-base md:text-lg leading-relaxed text-black placeholder:text-black/35 focus:border-black focus:outline-none"
          />

          <button
            type="button"
            className="mt-6 w-full bg-black px-6 py-5 font-mono text-[11px] tracking-[0.2em] uppercase text-white transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Deploy Outbound Engine
          </button>
        </div>

        <SecuredMeetingsTable />
      </div>
    </main>
  );
}
