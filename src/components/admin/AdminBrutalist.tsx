import type { ReactNode } from "react";

export const ADMIN_FIELD_LABEL_CLASS =
  "mb-2 block font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase";

export const ADMIN_INPUT_CLASS =
  "w-full border border-hairline bg-paper px-3 py-2 font-mono text-[12px] text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none disabled:opacity-50";

export const ADMIN_TEXTAREA_CLASS =
  "min-h-[100px] w-full resize-y border border-hairline bg-paper px-3 py-2 font-mono text-[12px] leading-relaxed text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none disabled:opacity-50";

type AdminPageHeaderProps = {
  code: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

export function AdminPageHeader({ code, title, description, trailing }: AdminPageHeaderProps) {
  return (
    <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="eyebrow mb-3">{code}</div>
        <h1 className="font-display text-[clamp(2rem,6vw,3.5rem)] leading-[0.9] tracking-[-0.04em] uppercase">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-xl font-mono text-[11px] leading-relaxed tracking-[0.08em] text-ink-soft uppercase">
            {description}
          </p>
        ) : null}
      </div>
      {trailing}
    </header>
  );
}

type AdminKpiCardProps = {
  label: string;
  value: string;
  isLoading?: boolean;
};

export function AdminKpiCard({ label, value, isLoading }: AdminKpiCardProps) {
  return (
    <div className="flex min-h-[140px] flex-col justify-between border-t border-hairline py-1 md:border-t-0 md:border-l md:pl-6 first:md:border-l-0 first:md:pl-0">
      <p className="font-mono text-[10px] tracking-[0.26em] text-ink/45 uppercase">{label}</p>
      <p className="font-display text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.85] tracking-[-0.05em] text-ink tabular-nums">
        {isLoading ? "—" : value}
      </p>
    </div>
  );
}

type AdminDataTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: AdminDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  recordLabel?: string;
  onRowClick?: (row: T) => void;
};

export function AdminDataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyMessage = "NO_RECORDS",
  recordLabel,
  onRowClick,
}: AdminDataTableProps<T>) {
  return (
    <section>
      {recordLabel ? (
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[11px] tracking-[0.28em] text-ink/50 uppercase">
            {recordLabel}
          </h2>
          {!isLoading ? (
            <span className="font-mono text-[10px] tracking-[0.14em] text-ink/40 uppercase tabular-nums">
              {rows.length} records
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto border border-hairline">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-ink/[0.03] font-mono text-[9px] tracking-[0.22em] text-ink/40 uppercase">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-normal ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono text-[11px] tracking-[0.06em] text-ink">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-ink/40 uppercase">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-ink/40 uppercase">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={`border-t border-hairline/80 ${
                    onRowClick
                      ? "cursor-pointer transition-colors hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04] focus-visible:outline-none"
                      : ""
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-4 ${col.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type AdminTerminalFieldProps = {
  id: string;
  label: string;
  type?: "text" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
};

export function AdminTerminalField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
}: AdminTerminalFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={ADMIN_FIELD_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={ADMIN_INPUT_CLASS}
        autoComplete="off"
      />
      {hint ? (
        <p className="mt-2 font-mono text-[9px] tracking-[0.12em] text-ink/35 uppercase">{hint}</p>
      ) : null}
    </div>
  );
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
