import { useCallback, useEffect, useState } from "react";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";
import { useClientRoute } from "./ClientRouteContext";

type VaultField = "core_offer" | "target_icp" | "case_studies" | "tone_of_voice";

const VAULT_FIELDS: {
  key: VaultField;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "core_offer",
    label: "Core Offer",
    placeholder: "What exactly does this client sell?",
  },
  {
    key: "target_icp",
    label: "Target Icp",
    placeholder: "Who are we targeting? (Titles, Industries, Revenue)",
  },
  {
    key: "case_studies",
    label: "Case Studies",
    placeholder: "Proof of work, metrics, and past results.",
  },
  {
    key: "tone_of_voice",
    label: "Tone Of Voice",
    placeholder: "Brand voice parameters.",
  },
];

export function WorkspaceSettings() {
  const routeClient = useClientRoute();
  const clientId = routeClient.id ?? "";

  const [client, setClient] = useState<ClientRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (!clientId) {
      setClient(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchClient = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (cancelled) return;

      if (error) {
        console.error("VAULT FETCH ERROR:", error);
        setClient(null);
      } else {
        setClient(data as ClientRow);
      }

      setIsLoading(false);
    };

    void fetchClient();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleFieldChange = useCallback((field: VaultField, value: string) => {
    setClient((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSaveStatus("idle");
  }, []);

  const handleSave = async () => {
    if (!clientId || !client || isSaving) return;

    setIsSaving(true);
    setSaveStatus("idle");

    const { error } = await supabase
      .from("clients")
      .update({
        core_offer: client.core_offer ?? "",
        target_icp: client.target_icp ?? "",
        case_studies: client.case_studies ?? "",
        tone_of_voice: client.tone_of_voice ?? "",
      })
      .eq("id", clientId);

    if (error) {
      console.error("VAULT SAVE ERROR:", error);
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        LOADING_KNOWLEDGE_VAULT...
      </p>
    );
  }

  if (!client) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        VAULT_UNAVAILABLE
      </p>
    );
  }

  const companyName = client.company_name?.trim() ?? "Unknown Client";

  return (
    <section className="space-y-8">
      <header className="border-b border-hairline pb-6">
        <div className="eyebrow mb-3">Workspace 05 // Settings</div>
        <h1 className="font-display text-[clamp(1.75rem,4vw,3rem)] leading-[0.9] tracking-[-0.04em]">
          [ KNOWLEDGE_VAULT ] — {companyName.toUpperCase()}
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          CLIENT_CONTEXT // AGENT_GROUNDING_LAYER
        </p>
      </header>

      <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline lg:grid-cols-2">
        {VAULT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col bg-paper">
            <label
              htmlFor={`vault-${field.key}`}
              className="border-b border-hairline px-4 py-3 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft"
            >
              [ {field.label.replace(/\s+/g, "_").toUpperCase()} ]
            </label>
            <textarea
              id={`vault-${field.key}`}
              value={client[field.key] ?? ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={8}
              className="min-h-[180px] w-full resize-y rounded-none border border-gray-800 bg-black px-3 py-3 font-mono text-xs leading-relaxed text-paper placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-700"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft">
          {saveStatus === "saved" && "VAULT_CONFIGURATION_SYNCED"}
          {saveStatus === "error" && "SYNC_FAILED // CHECK_CONSOLE"}
          {saveStatus === "idle" && "UNSAVED_CHANGES_PERSIST_ON_SAVE"}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-none border border-hairline bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "[ SYNCING... ]" : "[ SAVE_VAULT_CONFIGURATION ]"}
        </button>
      </div>
    </section>
  );
}
