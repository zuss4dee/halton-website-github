import { useState } from "react";
import { Plus } from "lucide-react";
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
import { insertManualPipelineLead } from "@/lib/admin/manualLeadInsert";

const EMPTY_FORM = {
  email: "",
  firstName: "",
  companyName: "",
};

type AddLeadSheetProps = {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
};

export function AddLeadSheet({
  clientId,
  open,
  onOpenChange,
  onSuccess,
}: AddLeadSheetProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isSubmitting) {
      resetForm();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await insertManualPipelineLead({
      clientId,
      email: form.email,
      firstName: form.firstName,
      companyName: form.companyName,
    });

    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    toast.success("Lead added to active sequence");
    resetForm();
    onOpenChange(false);
    await onSuccess();
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
            Add Lead
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
              id="add-lead-email"
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
              id="add-lead-first-name"
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
              id="add-lead-company"
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
            disabled={isSubmitting || !form.email.trim()}
            className="w-full border border-ink bg-ink px-5 py-2.5 font-mono text-[10px] tracking-[0.18em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Adding…" : "Add to Pipeline"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

type AddLeadTriggerProps = {
  onClick: () => void;
};

export function AddLeadTrigger({ onClick }: AddLeadTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 border border-ink bg-ink px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] text-paper uppercase transition-opacity hover:opacity-90"
    >
      <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      Add Lead
    </button>
  );
}
