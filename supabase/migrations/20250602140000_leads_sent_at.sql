-- Outbox / sent history support for human review queue
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

COMMENT ON COLUMN public.leads.sent_at IS
  'Timestamp when an admin approved and sent the draft from the outbound queue.';

CREATE INDEX IF NOT EXISTS leads_client_outbox_idx
  ON public.leads (client_id, campaign_status, sent_at DESC NULLS LAST);
