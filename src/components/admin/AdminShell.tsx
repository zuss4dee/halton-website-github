import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen flex-col md:flex-row">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
