import { useEffect, useState, type ReactNode } from "react";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { supabase } from "@/lib/supabase";

interface WorkspaceInfrastructureProps {
  clientId?: string;
}

interface InfrastructureKeysState {
  apollo: string;
  deepseek: string;
  resend: string;
  firecrawl: string;
  notionApiKey: string;
  notionDbId: string;
  slackWebhook: string;
  calComKey: string;
}

const EMPTY_KEYS: InfrastructureKeysState = {
  apollo: "",
  deepseek: "",
  resend: "",
  firecrawl: "",
  notionApiKey: "",
  notionDbId: "",
  slackWebhook: "",
  calComKey: "",
};

type ClientInfraRow = {
  apollo_api_key?: string | null;
  deepseek_api_key?: string | null;
  resend_api_key?: string | null;
  firecrawl_api_key?: string | null;
  notion_api_key?: string | null;
  notion_database_id?: string | null;
  slack_webhook_url?: string | null;
  cal_com_api_key?: string | null;
};

function mapRowToKeys(data: ClientInfraRow): InfrastructureKeysState {
  return {
    apollo: data.apollo_api_key ?? "",
    deepseek: data.deepseek_api_key ?? "",
    resend: data.resend_api_key ?? "",
    firecrawl: data.firecrawl_api_key ?? "",
    notionApiKey: data.notion_api_key ?? "",
    notionDbId: data.notion_database_id ?? "",
    slackWebhook: data.slack_webhook_url ?? "",
    calComKey: data.cal_com_api_key ?? "",
  };
}

type KeyFieldProps = {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
};

function KeyField({ id, label, hint, value, onChange }: KeyFieldProps) {
  return (
    <div className="flex flex-col bg-black">
      <label
        htmlFor={id}
        className="border-b border-gray-800 px-4 py-3 font-mono text-[10px] tracking-[0.2em] uppercase text-gray-500"
      >
        {label}
      </label>
      <div className="border-b border-gray-800 px-4 py-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-gray-600">
        {hint}
      </div>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 bg-black px-4 py-3 font-mono text-xs text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-700"
        placeholder="••••••••••••••••"
        autoComplete="off"
      />
    </div>
  );
}

function VaultSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400">{title}</h2>
      <div className="grid grid-cols-1 gap-px border border-gray-800 bg-gray-800">{children}</div>
    </div>
  );
}

export function WorkspaceInfrastructure({ clientId: clientIdProp }: WorkspaceInfrastructureProps) {
  const client = useClientRoute();
  const activeClientId = client.id ?? clientIdProp ?? "";

  const [keys, setKeys] = useState<InfrastructureKeysState>(EMPTY_KEYS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningOutbound, setIsRunningOutbound] = useState(false);
  const [outboundReport, setOutboundReport] = useState<string | null>(null);
  const [outboundError, setOutboundError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchKeys = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("clients")
        .select(
          "apollo_api_key, deepseek_api_key, resend_api_key, firecrawl_api_key, notion_api_key, notion_database_id, slack_webhook_url, cal_com_api_key",
        )
        .eq("id", activeClientId)
        .single();

      if (cancelled) return;

      if (error) {
        console.error("INFRA_VAULT_FETCH_ERROR:", error);
      } else if (data) {
        setKeys(mapRowToKeys(data as ClientInfraRow));
      }

      setIsLoading(false);
    };

    if (!activeClientId) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void fetchKeys();

    return () => {
      cancelled = true;
    };
  }, [activeClientId]);

  const handleChange = (field: keyof InfrastructureKeysState, value: string) => {
    setKeys((prev) => ({ ...prev, [field]: value }));
    setStatus("idle");
  };

  const handleSave = async () => {
    if (!activeClientId || isSaving) return;

    setIsSaving(true);
    setStatus("idle");

    const { error } = await supabase
      .from("clients")
      .update({
        apollo_api_key: keys.apollo,
        deepseek_api_key: keys.deepseek,
        resend_api_key: keys.resend,
        firecrawl_api_key: keys.firecrawl,
        notion_api_key: keys.notionApiKey,
        notion_database_id: keys.notionDbId,
        slack_webhook_url: keys.slackWebhook,
        cal_com_api_key: keys.calComKey,
      })
      .eq("id", activeClientId);

    if (error) {
      console.error("INFRA_VAULT_SAVE_ERROR:", error);
      setStatus("error");
    } else {
      setStatus("saved");
    }

    setIsSaving(false);
  };

  const handleRunOutboundTest = async () => {
    const resolvedClientId = client.id ?? clientIdProp;
    if (!resolvedClientId) {
      alert("ERROR: No active client UUID. Open a tenant workspace and try again.");
      return;
    }

    const testEmail = window.prompt(
      "Safemode destination email (Resend will send here, not to the Apollo lead):",
      "",
    );

    if (testEmail === null) return;

    const trimmedEmail = testEmail.trim();
    if (!trimmedEmail) {
      alert("ERROR: testEmail is required for safemode outbound test.");
      return;
    }

    setIsRunningOutbound(true);
    setOutboundReport(null);
    setOutboundError(null);

    try {
      const { data, error } = await supabase.functions.invoke("run-outbound", {
        body: {
          clientId: resolvedClientId,
          testEmail: trimmedEmail,
        },
      });

      const payload = data as { error?: string; success?: boolean } | null;

      if (payload?.error) {
        throw new Error(payload.error);
      }

      if (error) {
        throw error;
      }

      setOutboundReport(JSON.stringify(payload, null, 2));
    } catch (err: unknown) {
      console.error("RUN_OUTBOUND_TEST_ERROR:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setOutboundError(message);
    } finally {
      setIsRunningOutbound(false);
    }
  };

  const handleTestNotion = async () => {
    const resolvedClientId = client.id ?? clientIdProp;
    if (!resolvedClientId) {
      alert("ERROR: No active client UUID. Open a tenant workspace and try again.");
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-notion", {
        body: { clientId: resolvedClientId },
      });
      if (error) throw error;
      alert("SUCCESS: Test lead pushed to Notion CRM!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`ERROR: ${message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!activeClientId) {
    return (
      <p className="bg-black font-mono text-[11px] tracking-[0.2em] uppercase text-gray-500">
        CLIENT_CONTEXT_UNAVAILABLE // MISSING_UUID
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="bg-black font-mono text-[11px] tracking-[0.2em] uppercase text-gray-500">
        LOADING_INFRASTRUCTURE_VAULT...
      </p>
    );
  }

  return (
    <section className="space-y-10 bg-black font-mono text-gray-300">
      <header className="border-b border-gray-800 pb-6">
        <div className="mb-3 text-[10px] tracking-[0.2em] uppercase text-gray-500">
          Workspace 04 // Infrastructure
        </div>
        <h1 className="text-[clamp(1.25rem,3vw,2rem)] tracking-[0.08em] uppercase text-gray-200">
          [ INFRASTRUCTURE_VAULT ] - INTEGRATION KEYS
        </h1>
        <p className="mt-4 text-[10px] tracking-[0.14em] uppercase text-gray-500">
          TENANT_SCOPED // HIGH_DENSITY_SECRET_GRID
        </p>
      </header>

      <VaultSection title="// INBOUND_OUTBOUND_ENGINES">
        <div className="grid grid-cols-1 bg-gray-800 lg:grid-cols-2">
          <KeyField
            id="infra-apollo"
            label="[ APOLLO_API_KEY ]"
            hint="For real-time B2B lead generation."
            value={keys.apollo}
            onChange={(value) => handleChange("apollo", value)}
          />
          <KeyField
            id="infra-deepseek"
            label="[ DEEPSEEK_API_KEY ]"
            hint="For CEO and sub-agent orchestration models."
            value={keys.deepseek}
            onChange={(value) => handleChange("deepseek", value)}
          />
          <KeyField
            id="infra-resend"
            label="[ RESEND_API_KEY ]"
            hint="For executing live outbound email campaigns."
            value={keys.resend}
            onChange={(value) => handleChange("resend", value)}
          />
          <KeyField
            id="infra-firecrawl"
            label="[ FIRECRAWL_API_KEY ]"
            hint="For deep website scraping and context gathering."
            value={keys.firecrawl}
            onChange={(value) => handleChange("firecrawl", value)}
          />
        </div>
      </VaultSection>

      <div className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400">
          // SYSTEM_INTEGRATIONS
        </h2>
        <div className="grid grid-cols-1 gap-px border border-gray-800 bg-gray-800 lg:grid-cols-2">
          <KeyField
            id="infra-notion-key"
            label="[ NOTION_API_KEY ]"
            hint="For reading/writing inbound and outbound lead data to your CRM."
            value={keys.notionApiKey}
            onChange={(value) => handleChange("notionApiKey", value)}
          />
          <KeyField
            id="infra-notion-db"
            label="[ NOTION_DATABASE_ID ]"
            hint="The target target database ID inside your workspace."
            value={keys.notionDbId}
            onChange={(value) => handleChange("notionDbId", value)}
          />
        </div>
        <button
          type="button"
          onClick={handleTestNotion}
          disabled={isTesting}
          className="mt-4 border border-gray-800 bg-gray-900 px-4 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-800"
        >
          {isTesting ? "[ PUSHING_TO_CRM... ]" : "[ TEST_NOTION_SYNC ]"}
        </button>
        <div className="grid grid-cols-1 gap-px border border-gray-800 bg-gray-800 lg:grid-cols-2">
          <KeyField
            id="infra-slack"
            label="[ SLACK_WEBHOOK_URL ]"
            hint="For firing instant telemetry alerts and human approvals."
            value={keys.slackWebhook}
            onChange={(value) => handleChange("slackWebhook", value)}
          />
          <KeyField
            id="infra-calcom"
            label="[ CAL_COM_API_KEY ]"
            hint="For verifying and coordinating scheduling links."
            value={keys.calComKey}
            onChange={(value) => handleChange("calComKey", value)}
          />
        </div>
      </div>

      <div className="space-y-4 border border-gray-800 p-4">
        <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400">
          // ENGINE_DIAGNOSTICS
        </h2>
        <p className="text-[10px] leading-relaxed tracking-[0.12em] text-gray-600">
          Apollo search → enrich → DeepSeek copy → Resend safemode. Lock vault keys before
          running.
        </p>
        <button
          type="button"
          onClick={() => void handleRunOutboundTest()}
          disabled={isRunningOutbound}
          className="border border-gray-800 bg-gray-900 px-4 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRunningOutbound ? "[ RUNNING_OUTBOUND_ENGINE... ]" : "Test AI Outbound Engine"}
        </button>

        {isRunningOutbound ? (
          <p className="text-[10px] tracking-[0.14em] uppercase text-gray-500 animate-pulse">
            [ RUN_OUTBOUND_TEST ] // APOLLO → DEEPSEEK → RESEND...
          </p>
        ) : null}

        {outboundError ? (
          <pre className="max-h-96 overflow-auto border border-red-900/60 bg-black p-4 text-[11px] leading-relaxed text-red-400">
            {`ERROR: ${outboundError}`}
          </pre>
        ) : null}

        {outboundReport ? (
          <pre className="max-h-[28rem] overflow-auto border border-gray-800 bg-black p-4 text-[11px] leading-relaxed text-emerald-300/90">
            {outboundReport}
          </pre>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[10px] tracking-[0.16em] uppercase text-gray-500">
          {status === "saved" && "INFRA_KEYS_LOCKED"}
          {status === "error" && "LOCK_FAILED // CHECK_CONSOLE"}
          {status === "idle" && "CHANGES_NOT_SAVED_UNTIL_LOCK"}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="border border-gray-800 bg-black px-4 py-3 text-[11px] tracking-[0.16em] uppercase text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "[ LOCKING... ]" : "[ LOCK_INFRASTRUCTURE_KEYS ]"}
        </button>
      </div>
    </section>
  );
}
