import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function WorkspaceSettings() {
  const [open, setOpen] = useState(false);
  const [instantlyApiKey, setInstantlyApiKey] = useState("");
  const [apolloApiKey, setApolloApiKey] = useState("");

  function handleSave() {
    console.info("[Workspace] Configuration saved", {
      instantlyApiKey: instantlyApiKey ? "[set]" : "[empty]",
      apolloApiKey: apolloApiKey ? "[set]" : "[empty]",
    });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/55 underline-offset-4 transition-colors hover:text-black hover:underline"
      >
        Settings
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 rounded-none border border-black/15 bg-white p-0 text-black shadow-none sm:rounded-none [&>button]:rounded-none [&>button]:text-black/50 [&>button]:hover:text-black [&>button]:focus:ring-black">
          <DialogHeader className="border-b border-black/12 px-6 py-5 text-left">
            <DialogTitle className="font-mono text-[10px] font-normal tracking-[0.22em] uppercase text-black/45">
              Configuration
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-6 py-6">
            <div className="space-y-2">
              <label
                htmlFor="instantly-api-key"
                className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/50"
              >
                Instantly API Key
              </label>
              <input
                id="instantly-api-key"
                type="password"
                autoComplete="off"
                value={instantlyApiKey}
                onChange={(e) => setInstantlyApiKey(e.target.value)}
                className="w-full border border-black/15 bg-white px-4 py-3 font-mono text-sm text-black placeholder:text-black/30 focus:border-black focus:outline-none"
                placeholder="••••••••••••••••"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="apollo-api-key"
                className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/50"
              >
                Apollo API Key
              </label>
              <input
                id="apollo-api-key"
                type="password"
                autoComplete="off"
                value={apolloApiKey}
                onChange={(e) => setApolloApiKey(e.target.value)}
                className="w-full border border-black/15 bg-white px-4 py-3 font-mono text-sm text-black placeholder:text-black/30 focus:border-black focus:outline-none"
                placeholder="••••••••••••••••"
              />
            </div>
          </div>

          <div className="border-t border-black/12 px-6 py-5">
            <button
              type="button"
              onClick={handleSave}
              className="w-full bg-black px-6 py-4 font-mono text-[11px] tracking-[0.2em] uppercase text-white transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Save Configuration
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
