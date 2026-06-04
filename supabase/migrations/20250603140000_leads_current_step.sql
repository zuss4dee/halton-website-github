-- Multi-touch sequence position for automated follow-up sweeper
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.leads.current_step IS
  'Outbound sequence touch number; incremented when cron sweeper requeues for follow-up.';
