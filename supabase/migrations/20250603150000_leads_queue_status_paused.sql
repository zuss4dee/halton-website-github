-- Allow paused queue status when inbound replies halt the follow-up sequence
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_queue_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_queue_status_check
  CHECK (
    queue_status IS NULL
    OR queue_status IN ('pending', 'sent', 'discarded', 'paused')
  );

COMMENT ON COLUMN public.leads.queue_status IS
  'Human review queue: pending | sent | discarded | paused (inbound reply halt).';
