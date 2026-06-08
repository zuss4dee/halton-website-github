import { useCallback, useEffect, useState } from "react";
import { DeleteWorkspaceDialog } from "@/components/admin/DeleteWorkspaceDialog";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";
import { useClientRoute } from "./ClientRouteContext";

type GroundingField = "target_icp" | "tone_of_voice";

const GROUNDING_FIELDS: {
  key: GroundingField;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "target_icp",
    label: "Target ICP",
    placeholder: "Who are we targeting? Titles, industries, company size, and buying triggers.",
  },
  {
    key: "tone_of_voice",
    label: "Tone of Voice",
    placeholder: "Brand voice, writing style, and phrasing guardrails for outbound copy.",
  },
];

const textareaClassName =
  "min-h-[180px] w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-sm leading-relaxed text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200";

export function WorkspaceSettings() {
  const routeClient = useClientRoute();
  const clientId = routeClient.id ?? "";

  const [client, setClient] = useState<ClientRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const handleFieldChange = useCallback((field: GroundingField, value: string) => {
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
        target_icp: client.target_icp ?? "",
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
    return <p className="text-sm text-gray-500">Loading agent grounding…</p>;
  }

  if (!client) {
    return <p className="text-sm text-gray-500">Settings unavailable for this client.</p>;
  }

  const workspaceName = client.company_name?.trim() || "Unnamed workspace";

  return (
    <>
      <section className="space-y-8">
      <header className="border-b border-gray-200 pb-8">
        <h1 className="text-3xl font-bold text-gray-900">Agent Grounding</h1>
        <p className="mt-2 text-sm text-gray-500">
          Configure the core instructions, tone, and guardrails for the AI writer.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {GROUNDING_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <label
              htmlFor={`grounding-${field.key}`}
              className="mb-2 text-sm font-medium text-gray-700"
            >
              {field.label}
            </label>
            <textarea
              id={`grounding-${field.key}`}
              value={client[field.key] ?? ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={8}
              className={textareaClassName}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-500">
          {saveStatus === "saved" && (
            <span className="text-emerald-700">Configuration saved.</span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600">Save failed. Check the console for details.</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      <section className="border border-hairline bg-paper">
        <div className="border-b border-hairline px-6 py-5">
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#c03939] uppercase">
            Danger zone
          </p>
          <h2 className="mt-2 font-display text-xl leading-[0.95] tracking-[-0.03em] text-ink uppercase">
            Delete this workspace
          </h2>
          <p className="mt-3 max-w-xl font-mono text-[11px] leading-relaxed tracking-[0.06em] text-ink-soft">
            Permanently remove {workspaceName} and wipe all agents, campaigns, and logs tied to
            this client. This action cannot be reversed.
          </p>
        </div>
        <div className="px-6 py-5">
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="border border-[#c03939] px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-[#c03939] transition-colors hover:bg-[#c03939] hover:text-paper"
          >
            Delete workspace
          </button>
        </div>
      </section>
    </section>

      <DeleteWorkspaceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        clientId={clientId}
        workspaceName={workspaceName}
      />
    </>
  );
}
