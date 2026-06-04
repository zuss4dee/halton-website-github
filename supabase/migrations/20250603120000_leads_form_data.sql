-- Tally (and other intake) form submissions stored on the lead record.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS form_data jsonb;

COMMENT ON COLUMN public.leads.form_data IS
  'JSONB payload from intake forms (e.g. Tally webhook fields).';
