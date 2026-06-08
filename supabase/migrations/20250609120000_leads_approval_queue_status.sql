-- Approval gate queue statuses for QA auto-approve and human review
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_queue_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_queue_status_check
  CHECK (
    queue_status IS NULL
    OR queue_status IN (
      'pending',
      'approved',
      'needs_human_review',
      'qa_rejected',
      'sent',
      'discarded',
      'paused',
      'active',
      'completed'
    )
  );

COMMENT ON COLUMN public.leads.queue_status IS
  'Outbox/sequence: pending | approved | needs_human_review | qa_rejected | sent | discarded | paused | active | completed.';
