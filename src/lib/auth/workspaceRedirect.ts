import { redirect } from "@tanstack/react-router";

/** Typed redirect to a single-client workspace (param must be client UUID or slug). */
export function redirectToWorkspaceClient(clientId: string) {
  return redirect({
    to: "/workspace/$clientId",
    params: { clientId },
  });
}
