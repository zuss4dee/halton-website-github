import { createFileRoute } from "@tanstack/react-router";
import { FinancialLedger } from "@/components/admin/FinancialLedger";

export const Route = createFileRoute("/admin/ledger")({
  head: () => ({
    meta: [
      { title: "Halton/Works — Financial Ledger" },
      {
        name: "description",
        content:
          "Platform owner financial ledger — MRR, retainer status, API costs, and net margin.",
      },
    ],
  }),
  component: AdminLedgerPage,
});

function AdminLedgerPage() {
  return <FinancialLedger />;
}
