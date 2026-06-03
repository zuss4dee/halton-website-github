const items = [
  "Intent-Based Scraping",
  "Domain Protection",
  "Automated Routing",
  "Zero Human Error",
];

export function Ticker() {
  const loop = [...items, ...items];
  return (
    <div className="relative border-y border-hairline overflow-hidden bg-paper">
      <div className="ticker flex whitespace-nowrap py-4 md:py-6">
        {loop.map((t, i) => (
          <div key={i} className="flex items-center gap-6 sm:gap-10 px-6 sm:px-10 font-display text-2xl sm:text-3xl md:text-5xl tracking-[-0.03em]">
            <span>{t}</span>
            <span className="inline-block w-2 h-2 bg-ink rotate-45" />
          </div>
        ))}
      </div>
    </div>
  );
}
