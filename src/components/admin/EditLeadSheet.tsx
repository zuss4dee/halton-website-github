import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ADMIN_FIELD_LABEL_CLASS,
  ADMIN_INPUT_CLASS,
} from "@/components/admin/AdminBrutalist";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { updateCrmLead } from "@/lib/admin/leadsCrmMutations";
import type { LeadRow } from "@/lib/admin/leadsRepository";

type EditLeadSheetProps = {
  clientId: string;
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (lead: LeadRow) => void | Promise<void>;
};

function leadToForm(lead: LeadRow | null) {
  return {
    email: lead?.email?.trim() ?? "",
    firstName: lead?.prospect_name?.trim() ?? "",
    companyName: lead?.target_company?.trim() ?? lead?.company_name?.trim() ?? "",
  };
}

export function EditLeadSheet({
  clientId,
  lead,
  open,
  onOpenChange,
  onSuccess,
}: EditLeadSheetProps) {
  const [form, setForm] = useState(leadToForm(lead));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(leadToForm(lead));
      setError(null);
    }
  }, [lead, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !isSubmitting) {
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lead?.id) return;

    setError(null);
    setIsSubmitting(true);

    const result = await updateCrmLead({
      clientId,
      leadId: lead.id,
      email: form.email,
      firstName: form.firstName,
      companyName: form.companyName,
    });

    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    toast.success("Lead updated");
    onOpenChange(false);
    await onSuccess(result.lead);
    setIsSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-hairline bg-paper sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-[-0.03em] uppercase">
            Edit Lead
          </SheetTitle>
          <SheetDescription className="font-mono text-[10px] tracking-[0.12em] text-ink-soft uppercase">
            Manual prospect · active sequence queue
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-6">
          <label className="block">
            <span className={ADMIN_FIELD_LABEL_CLASS}>
              Email Address <span className="text-ink">*</span>
            </span>
            <input
              id="edit-lead-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              className={ADMIN_INPUT_CLASS}
              placeholder="prospect@company.com"
            />
          </label>

          <label className="block">
            <span className={ADMIN_FIELD_LABEL_CLASS}>First Name</span>
            <input
              id="edit-lead-first-name"
              type="text"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
              className={ADMIN_INPUT_CLASS}
              placeholder="Alex"
            />
          </label>

          <label className="block">
            <span className={ADMIN_FIELD_LABEL_CLASS}>Company Name</span>
            <input
              id="edit-lead-company"
              type="text"
              autoComplete="organization"
              value={form.companyName}
              onChange={(event) =>
                setForm((current) => ({ ...current, companyName: event.target.value }))
              }
              className={ADMIN_INPUT_CLASS}
              placeholder="Northline Freight"
            />
          </label>

          {error ? (
            <p className="border border-red-700/30 bg-red-50 px-3 py-2 font-mono text-[10px] tracking-[0.1em] text-red-800 uppercase">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || !form.email.trim() || !lead?.id}
            className="w-full border border-ink bg-ink px-5 py-2.5 font-mono text-[10px] tracking-[0.18em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
