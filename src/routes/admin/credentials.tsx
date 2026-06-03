import { createFileRoute } from "@tanstack/react-router";
import { CredentialsVaultUI } from "@/components/admin/CredentialsVaultUI";

export const Route = createFileRoute("/admin/credentials")({
  head: () => ({
    meta: [
      { title: "Halton/Works — Credentials Vault" },
      {
        name: "description",
        content: "Manage global and client-scoped API credentials.",
      },
    ],
  }),
  component: AdminCredentialsPage,
});

function AdminCredentialsPage() {
  return (
    <div className="space-y-8">
      <header className="border-b border-hairline pb-8 md:pb-10">
        <div className="eyebrow mb-4">Global // Credentials Vault</div>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.88] tracking-[-0.04em]">
          CREDENTIALS // VAULT
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          API_KEYS // GLOBAL_AND_CLIENT_SCOPED
        </p>
      </header>

      <CredentialsVaultUI />
    </div>
  );
}
