import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AdminSidebar } from "./AdminSidebar";

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isWorkflowPage = pathname.includes("/workflow");

  return (
    <div
      className={`bg-white text-gray-900 ${isWorkflowPage ? "h-screen overflow-hidden" : "min-h-screen"}`}
    >
      <div className={`flex flex-col md:flex-row ${isWorkflowPage ? "h-full" : "min-h-screen"}`}>
        <AdminSidebar />
        <main
          className={`min-w-0 flex-1 ${isWorkflowPage ? "h-full overflow-hidden" : "overflow-auto"}`}
        >
          <div
            className={`mx-auto w-full ${
              isWorkflowPage
                ? "flex h-full max-w-none flex-col overflow-hidden px-4 py-6 md:px-6"
                : "max-w-4xl px-6 pb-12 pt-8 md:px-8 md:pb-16"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
