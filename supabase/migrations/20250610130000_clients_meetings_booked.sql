-- KPI for booked discovery calls (Cal.com catch-booking webhook)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS meetings_booked integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.clients.meetings_booked IS
  'Count of discovery calls booked via catch-booking webhook for this workspace.';
