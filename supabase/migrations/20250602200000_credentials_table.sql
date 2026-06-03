-- Agency credentials vault (UI-managed API keys)
CREATE TABLE IF NOT EXISTS public.credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global', 'client')),
  client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credentials_client_scope_check CHECK (
    (scope = 'global' AND client_id IS NULL)
    OR (scope = 'client' AND client_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS credentials_global_name_unique
  ON public.credentials (name)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS credentials_client_name_unique
  ON public.credentials (name, client_id)
  WHERE scope = 'client';

CREATE INDEX IF NOT EXISTS credentials_client_id_idx
  ON public.credentials (client_id, updated_at DESC);

COMMENT ON TABLE public.credentials IS
  'UI-managed API keys. Global keys apply platform-wide; client keys are workspace-scoped.';
