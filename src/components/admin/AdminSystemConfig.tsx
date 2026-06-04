import { useState } from "react";
import { AdminPageHeader, AdminTerminalField } from "@/components/admin/AdminBrutalist";

const GLOBAL_KEY_FIELDS = [
  { id: "resend", label: "Resend API Key", hint: "ENV: RESEND_API_KEY" },
  { id: "anthropic", label: "Anthropic API Key", hint: "ENV: ANTHROPIC_API_KEY" },
  { id: "supabase-url", label: "Supabase Project URL", hint: "ENV: VITE_SUPABASE_URL" },
  { id: "supabase-anon", label: "Supabase Anon Key", hint: "ENV: VITE_SUPABASE_ANON_KEY" },
] as const;

export function AdminSystemConfig() {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <section className="space-y-10">
      <AdminPageHeader
        code="03 // SYSTEM_CONFIG"
        title="System Config"
        description="Global integration keys · scaffold only · persist via deployment env"
      />

      <form
        className="max-w-lg space-y-8 border border-hairline p-6"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="font-mono text-[9px] tracking-[0.18em] text-ink/40 uppercase">
          Values are not saved from this UI — wire secrets in Vercel / .env
        </p>

        {GLOBAL_KEY_FIELDS.map((field) => (
          <AdminTerminalField
            key={field.id}
            id={field.id}
            label={field.label}
            type={field.id.includes("key") || field.id === "supabase-anon" ? "password" : "text"}
            value={values[field.id] ?? ""}
            onChange={(next) => setValues((current) => ({ ...current, [field.id]: next }))}
            placeholder="••••••••••••"
            hint={field.hint}
          />
        ))}

        <button
          type="button"
          disabled
          className="w-full border border-ink/20 bg-ink/[0.04] px-3 py-2.5 font-mono text-[10px] tracking-[0.16em] text-ink/40 uppercase"
        >
          Save Config // Not Wired
        </button>
      </form>
    </section>
  );
}
