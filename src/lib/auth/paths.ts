export function isAuthExemptPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/workspace");
}

export function isWorkspaceIndexPath(pathname: string): boolean {
  return pathname === "/workspace" || pathname === "/workspace/";
}

export function workspaceClientIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/workspace\/([^/]+)/);
  return match?.[1] ?? null;
}
