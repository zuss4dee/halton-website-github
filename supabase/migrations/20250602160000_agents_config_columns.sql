-- Agent configuration: prompts, skills, workspace scope, active flag
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS agents_client_id_idx ON public.agents (client_id);

CREATE UNIQUE INDEX IF NOT EXISTS agents_workspace_role_unique
  ON public.agents (client_id, role)
  WHERE client_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agents_global_role_unique
  ON public.agents (role)
  WHERE client_id IS NULL;

COMMENT ON COLUMN public.agents.skills IS
  'Enabled tool/skill ids for this agent (e.g. read_knowledge_vault, apollo_scrape).';
COMMENT ON COLUMN public.agents.is_active IS
  'When false, agent is hidden from delegation and marked inactive in the roster.';
COMMENT ON COLUMN public.agents.client_id IS
  'NULL = global agent template; set = workspace-specific override for that client.';
