import { getAdminNavItem, type AdminViewId } from "@/lib/admin/adminViews";

type AdminPlaceholderViewProps = {
  viewId: AdminViewId;
};

export function AdminPlaceholderView({ viewId }: AdminPlaceholderViewProps) {
  const item = getAdminNavItem(viewId);
  const title = item?.placeholderTitle ?? "MODULE // 000";

  return (
    <section className="flex min-h-[60vh] flex-col border border-hairline">
      <header className="border-b border-hairline px-6 py-8 md:px-10 md:py-10">
        <div className="eyebrow mb-4">{item?.label}</div>
        <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[0.9] tracking-[-0.04em]">
          {title}
        </h1>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-16 md:px-10">
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
          Module shell ready · awaiting implementation
        </p>
      </div>
    </section>
  );
}
