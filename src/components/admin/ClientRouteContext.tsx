import { createContext, useContext, type ReactNode } from "react";
import type { ClientRow } from "@/lib/admin/clientsRepository";

const ClientRouteContext = createContext<ClientRow | null>(null);

type ClientRouteProviderProps = {
  client: ClientRow;
  children: ReactNode;
};

export function ClientRouteProvider({ client, children }: ClientRouteProviderProps) {
  return <ClientRouteContext.Provider value={client}>{children}</ClientRouteContext.Provider>;
}

export function useClientRoute() {
  const client = useContext(ClientRouteContext);
  if (!client) {
    throw new Error("useClientRoute must be used within ClientRouteProvider");
  }
  return client;
}
