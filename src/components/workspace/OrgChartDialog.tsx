import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrgChart } from "@/components/workspace/OrgChart";
import { useOrgChart } from "@/lib/workspace/useOrgChart";

type OrgChartDialogProps = {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OrgChartDialog({ clientId, open, onOpenChange }: OrgChartDialogProps) {
  const { tree, isLoading, error } = useOrgChart(clientId, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-paper p-0 shadow-none duration-300 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-none"
        aria-describedby="org-chart-dialog-description"
      >
        <DialogHeader className="shrink-0 border-b border-hairline px-6 py-5 text-left sm:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4 pr-10">
            <div>
              <p className="font-mono text-[10px] tracking-[0.28em] text-ink/40 uppercase">
                Management chain
              </p>
              <DialogTitle className="mt-2 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[0.95] tracking-[-0.04em] text-ink uppercase">
                Agent Org Chart
              </DialogTitle>
              <DialogDescription
                id="org-chart-dialog-description"
                className="mt-3 max-w-xl font-mono text-[11px] leading-relaxed tracking-[0.08em] text-ink-soft uppercase"
              >
                Live reporting hierarchy · updates when agents are hired or reassigned
              </DialogDescription>
            </div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-ink/35 uppercase">
              Reporting chain // live
            </p>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-10 sm:py-10">
          <OrgChart tree={tree} isLoading={isLoading} error={error} hideHeader />
        </div>
      </DialogContent>
    </Dialog>
  );
}
