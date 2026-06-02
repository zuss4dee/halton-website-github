-- Workspace-isolated human review queue & outbox
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS queue_status text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_queue_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_queue_status_check
  CHECK (
    queue_status IS NULL
    OR queue_status IN ('pending', 'sent', 'discarded')
  );

-- Backfill from legacy campaign_status
UPDATE public.leads
SET queue_status = 'pending'
WHERE queue_status IS NULL
  AND campaign_status = 'PENDING_REVIEW';

UPDATE public.leads
SET queue_status = 'sent'
WHERE queue_status IS NULL
  AND campaign_status = 'SENT';

UPDATE public.leads
SET queue_status = 'discarded'
WHERE queue_status IS NULL
  AND campaign_status = 'DISCARDED';

CREATE INDEX IF NOT EXISTS leads_workspace_queue_idx
  ON public.leads (client_id, queue_status, sent_at DESC NULLS LAST);

COMMENT ON COLUMN public.leads.queue_status IS
  'Human review queue: pending | sent | discarded. Always scope queries by client_id.';
COMMENT ON COLUMN public.leads.sent_at IS
  'When the admin approved and sent the draft (APPROVE_AND_SEND).';
