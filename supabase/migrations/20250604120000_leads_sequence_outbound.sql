-- Automated campaign sequence execution (cron process-outbound)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_send_date timestamptz,
  ADD COLUMN IF NOT EXISTS current_sequence_step integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.leads.next_send_date IS
  'When the next sequence email should be sent (UTC). Used with queue_status = active.';

COMMENT ON COLUMN public.leads.current_sequence_step IS
  '1-based step index into campaign_sequences for the next send.';

UPDATE public.leads
SET current_sequence_step = COALESCE(current_step, 1)
WHERE current_sequence_step IS NULL OR current_sequence_step < 1;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_queue_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_queue_status_check
  CHECK (
    queue_status IS NULL
    OR queue_status IN (
      'pending',
      'sent',
      'discarded',
      'paused',
      'active',
      'completed'
    )
  );

CREATE INDEX IF NOT EXISTS leads_active_next_send_idx
  ON public.leads (queue_status, next_send_date)
  WHERE queue_status = 'active';

COMMENT ON COLUMN public.leads.queue_status IS
  'Outbox/sequence state: pending, sent, discarded, paused, active (sequence runner), completed.';
