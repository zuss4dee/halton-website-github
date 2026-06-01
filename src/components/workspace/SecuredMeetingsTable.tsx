import { securedMeetings } from "@/lib/workspace/securedMeetings";

export function SecuredMeetingsTable() {
  return (
    <section className="mt-24 md:mt-32">
      <h2 className="font-display text-3xl md:text-5xl leading-[0.95] tracking-[-0.04em] text-black">
        Secured Meetings
      </h2>

      <div className="mt-10 border-t border-black/12">
        <div className="hidden md:grid md:grid-cols-12 gap-4 py-4 border-b border-black/12 font-mono text-[10px] tracking-[0.2em] uppercase text-black/50">
          <div className="col-span-3">Lead Name</div>
          <div className="col-span-3">Company</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Meeting Date</div>
          <div className="col-span-2 text-right">Calendar</div>
        </div>

        {securedMeetings.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-1 gap-4 border-b border-black/12 py-6 md:grid-cols-12 md:items-center md:gap-4 md:py-7"
          >
            <div className="md:col-span-3">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 md:hidden mb-1">
                Lead Name
              </div>
              <div className="font-display text-xl md:text-2xl tracking-[-0.03em] text-black">
                {row.leadName}
              </div>
            </div>
            <div className="md:col-span-3">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 md:hidden mb-1">
                Company
              </div>
              <div className="text-base md:text-lg text-black">{row.company}</div>
            </div>
            <div className="md:col-span-2">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 md:hidden mb-1">
                Role
              </div>
              <div className="text-sm md:text-base text-black/70">{row.role}</div>
            </div>
            <div className="md:col-span-2">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 md:hidden mb-1">
                Meeting Date
              </div>
              <div className="font-mono text-[11px] tracking-[0.08em] text-black">
                {row.meetingDate}
              </div>
            </div>
            <div className="md:col-span-2 md:text-right">
              <a
                href={row.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center border border-black bg-transparent px-4 py-2 font-mono text-[10px] tracking-[0.18em] uppercase text-black transition-colors hover:bg-black hover:text-white"
              >
                View Calendar
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
