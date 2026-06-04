import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const EMPTY_ONBOARD_FORM = {
  companyName: "",
  primaryContactEmail: "",
  temporaryPassword: "",
  targetIcp: "",
  coreOffer: "",
  sendingDomain: "",
};

type OnboardFormState = typeof EMPTY_ONBOARD_FORM;

const fieldLabelClassName =
  "mb-2 block font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase";

const inputClassName =
  "w-full border border-hairline bg-paper px-3 py-2 font-mono text-[12px] text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none disabled:opacity-50";

const textareaClassName =
  "min-h-[100px] w-full resize-y border border-hairline bg-paper px-3 py-2 font-mono text-[12px] leading-relaxed text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none disabled:opacity-50";

type OnboardClientSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
};

export function OnboardClientSheet({
  open,
  onOpenChange,
  onSuccess,
}: OnboardClientSheetProps) {
  const [form, setForm] = useState<OnboardFormState>(EMPTY_ONBOARD_FORM);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  const updateField = (field: keyof OnboardFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setOnboardError(null);
  };

  const resetForm = () => {
    setForm(EMPTY_ONBOARD_FORM);
    setOnboardError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isOnboarding) {
      resetForm();
    }
    onOpenChange(next);
  };

  const isFormValid =
    form.companyName.trim().length > 0 &&
    form.primaryContactEmail.trim().length > 0 &&
    form.temporaryPassword.length >= 8 &&
    form.sendingDomain.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const companyName = form.companyName.trim();
    const primaryContactEmail = form.primaryContactEmail.trim();
    const temporaryPassword = form.temporaryPassword;
    const targetIcp = form.targetIcp.trim();
    const coreOffer = form.coreOffer.trim();
    const sendingDomain = form.sendingDomain.trim();

    if (
      !companyName ||
      !primaryContactEmail ||
      !temporaryPassword ||
      !sendingDomain ||
      isOnboarding
    ) {
      setOnboardError(
        "Company name, contact email, temporary password (8+ chars), and sending domain are required.",
      );
      return;
    }

    setIsOnboarding(true);
    setOnboardError(null);

    try {
      const response = await fetch("/api/admin/onboard-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName,
          primaryContactEmail,
          temporaryPassword,
          targetIcp,
          coreOffer,
          sendingDomain,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setOnboardError(payload.error ?? "Onboarding failed.");
      } else {
        resetForm();
        onOpenChange(false);
        await onSuccess();
      }
    } catch (error) {
      console.error("ONBOARD ERROR:", error);
      setOnboardError(
        error instanceof Error ? error.message : "Onboarding request failed.",
      );
    }

    setIsOnboarding(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-hairline bg-paper text-ink sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-[-0.03em] uppercase">
            Onboard Client
          </SheetTitle>
          <SheetDescription className="font-mono text-[10px] tracking-[0.12em] text-ink-soft uppercase">
            Provision tenant · auth · outbound defaults
          </SheetDescription>
        </SheetHeader>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="onboard-company-name" className={fieldLabelClassName}>
              Company Name
            </label>
            <input
              id="onboard-company-name"
              type="text"
              value={form.companyName}
              onChange={(event) => updateField("companyName", event.target.value)}
              disabled={isOnboarding}
              placeholder="Acme Logistics Ltd"
              className={inputClassName}
              autoComplete="organization"
            />
          </div>

          <div>
            <label htmlFor="onboard-contact-email" className={fieldLabelClassName}>
              Primary Contact Email
            </label>
            <input
              id="onboard-contact-email"
              type="email"
              value={form.primaryContactEmail}
              onChange={(event) => updateField("primaryContactEmail", event.target.value)}
              disabled={isOnboarding}
              placeholder="founder@acme.com"
              className={inputClassName}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="onboard-temporary-password" className={fieldLabelClassName}>
              Temporary Password
            </label>
            <input
              id="onboard-temporary-password"
              type="text"
              value={form.temporaryPassword}
              onChange={(event) => updateField("temporaryPassword", event.target.value)}
              disabled={isOnboarding}
              placeholder="Min. 8 characters"
              className={inputClassName}
              autoComplete="new-password"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Creates the Supabase Auth login. Share securely with the client.
            </p>
          </div>

          <div>
            <label htmlFor="onboard-target-icp" className={fieldLabelClassName}>
              Target ICP
            </label>
            <textarea
              id="onboard-target-icp"
              value={form.targetIcp}
              onChange={(event) => updateField("targetIcp", event.target.value)}
              disabled={isOnboarding}
              placeholder="Titles, industries, company size, geography…"
              className={textareaClassName}
            />
          </div>

          <div>
            <label htmlFor="onboard-core-offer" className={fieldLabelClassName}>
              Core Offer
            </label>
            <textarea
              id="onboard-core-offer"
              value={form.coreOffer}
              onChange={(event) => updateField("coreOffer", event.target.value)}
              disabled={isOnboarding}
              placeholder="Offer, outcome, proof points…"
              className={textareaClassName}
            />
          </div>

          <div>
            <label htmlFor="onboard-sending-domain" className={fieldLabelClassName}>
              Sending Domain
            </label>
            <input
              id="onboard-sending-domain"
              type="text"
              value={form.sendingDomain}
              onChange={(event) => updateField("sendingDomain", event.target.value)}
              disabled={isOnboarding}
              placeholder="outbound.acme.com"
              className={inputClassName}
              autoComplete="off"
            />
          </div>

          {onboardError ? (
            <p className="text-sm text-red-600" role="alert">
              {onboardError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!isFormValid || isOnboarding}
            className="w-full border border-ink bg-ink px-5 py-2.5 font-mono text-[10px] tracking-[0.18em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isOnboarding ? "Provisioning…" : "ONBOARD CLIENT"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

type OnboardClientTriggerProps = {
  onClick: () => void;
  clientCount?: number;
};

export function OnboardClientTrigger({ onClick, clientCount }: OnboardClientTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border border-dashed border-hairline px-5 py-4 text-left transition-colors hover:border-ink/40 hover:bg-ink/[0.02]"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center border border-ink bg-ink text-paper">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>
        <span>
          <span className="block font-mono text-[11px] tracking-[0.14em] text-ink uppercase">
            Onboard new client
          </span>
          <span className="mt-1 block font-mono text-[9px] tracking-[0.12em] text-ink/45 uppercase">
            Tenant · login · sending domain
          </span>
        </span>
      </span>
      {typeof clientCount === "number" ? (
        <span className="shrink-0 font-mono text-[9px] tracking-[0.14em] text-ink/40 uppercase tabular-nums">
          {clientCount} active
        </span>
      ) : null}
    </button>
  );
}
