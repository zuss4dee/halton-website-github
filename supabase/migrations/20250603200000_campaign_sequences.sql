-- Multi-step outbound email sequences per client workspace
CREATE TABLE IF NOT EXISTS public.campaign_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number >= 1 AND step_number <= 3),
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  delay_days integer NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_sequences_client_step_unique
  ON public.campaign_sequences (client_id, step_number);

CREATE INDEX IF NOT EXISTS campaign_sequences_client_id_idx
  ON public.campaign_sequences (client_id, step_number);

COMMENT ON TABLE public.campaign_sequences IS
  'Three-step cold email sequence templates (cold, follow-up, breakup) per client.';

COMMENT ON COLUMN public.campaign_sequences.delay_days IS
  'Days to wait after the previous step before sending this step (step 1 is typically 0).';

ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_sequences_select_scoped ON public.campaign_sequences;
CREATE POLICY campaign_sequences_select_scoped ON public.campaign_sequences
  FOR SELECT
  USING (
    public.is_admin()
    OR client_id = public.my_client_id()
  );

DROP POLICY IF EXISTS campaign_sequences_admin_manage ON public.campaign_sequences;
CREATE POLICY campaign_sequences_admin_manage ON public.campaign_sequences
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
