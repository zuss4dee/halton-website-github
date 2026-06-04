-- Workspace-scoped email templates for outbound AI copy
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_client_name_unique
  ON public.email_templates (client_id, name);

CREATE INDEX IF NOT EXISTS email_templates_client_id_idx
  ON public.email_templates (client_id, updated_at DESC);

COMMENT ON TABLE public.email_templates IS
  'Base email frameworks and follow-up structures per client workspace.';
