-- Inbound reply tracking
CREATE TABLE IF NOT EXISTS public.replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS replies_lead_id_idx ON public.replies (lead_id, created_at DESC);

COMMENT ON TABLE public.replies IS 'Inbound email reply bodies linked to leads.';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_activity timestamptz;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_hot_lead boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.last_activity IS 'Last inbound reply or meaningful engagement timestamp.';
COMMENT ON COLUMN public.leads.is_hot_lead IS 'True when reply text matches booking-intent keywords.';
COMMENT ON COLUMN public.leads.status IS 'Pipeline status; set to replied on inbound webhook.';
