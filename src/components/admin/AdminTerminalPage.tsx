import { AdminPageHeader } from "@/components/admin/AdminBrutalist";

type AdminTerminalPageProps = {
  code: string;
  title: string;
  description: string;
};

/** Legacy placeholder shell — prefer dedicated page components. */
export function AdminTerminalPage({ code, title, description }: AdminTerminalPageProps) {
  return (
    <section className="space-y-8">
      <AdminPageHeader code={code} title={title} description={description} />
      <p className="font-mono text-[10px] tracking-[0.2em] text-ink/40 uppercase">
        MODULE_PENDING // WIRE_UP_IN_NEXT_SPRINT
      </p>
    </section>
  );
}
