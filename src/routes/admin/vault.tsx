import { createFileRoute } from "@tanstack/react-router";
import { InfrastructureVault } from "@/components/admin/InfrastructureVault";

export const Route = createFileRoute("/admin/vault")({
  head: () => ({
    meta: [
      { title: "Halton/Works — Global Vault" },
      {
        name: "description",
        content: "Platform owner global infrastructure vault.",
      },
    ],
  }),
  component: AdminVaultPage,
});

function AdminVaultPage() {
  return <InfrastructureVault />;
}
