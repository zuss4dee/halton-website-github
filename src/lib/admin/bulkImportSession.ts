import type { BulkImportStatus } from "@/components/admin/ImportStatusBanner";

const STORAGE_KEY = "halton-bulk-import-status";

export function readBulkImportSession(clientId: string): BulkImportStatus | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { clientId?: string; status?: BulkImportStatus };
    if (parsed.clientId !== clientId.trim() || !parsed.status) return null;
    return parsed.status;
  } catch {
    return null;
  }
}

export function writeBulkImportSession(clientId: string, status: BulkImportStatus | null): void {
  if (typeof window === "undefined") return;

  try {
    if (!status) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ clientId: clientId.trim(), status }),
    );
  } catch {
    // ignore quota / private mode
  }
}
