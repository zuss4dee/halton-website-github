import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AdminViewId } from "@/lib/admin/adminViews";

type AdminViewContextValue = {
  currentView: AdminViewId;
  setCurrentView: (view: AdminViewId) => void;
};

const AdminViewContext = createContext<AdminViewContextValue | null>(null);

export function AdminViewProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<AdminViewId>("global");

  const value = useMemo(
    () => ({
      currentView,
      setCurrentView,
    }),
    [currentView],
  );

  return <AdminViewContext.Provider value={value}>{children}</AdminViewContext.Provider>;
}

export function useAdminView() {
  const context = useContext(AdminViewContext);
  if (!context) {
    throw new Error("useAdminView must be used within AdminViewProvider");
  }
  return context;
}
