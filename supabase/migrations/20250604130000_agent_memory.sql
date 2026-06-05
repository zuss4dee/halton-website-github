-- Persistent operational memory for agent self-evolution (global + workspace-local lessons)
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  task_summary text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE')),
  learned_strategy text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_memory_workspace_id_check CHECK (
    workspace_id = 'GLOBAL'
    OR workspace_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
);

CREATE INDEX IF NOT EXISTS agent_memory_workspace_created_idx
  ON public.agent_memory (workspace_id, created_at DESC);

COMMENT ON TABLE public.agent_memory IS
  'Learned operational lessons per workspace or GLOBAL shared memory for agent self-evolution.';
COMMENT ON COLUMN public.agent_memory.workspace_id IS
  'GLOBAL for agency-wide lessons, or a client workspace UUID for local lessons.';
COMMENT ON COLUMN public.agent_memory.learned_strategy IS
  'Actionable lesson the agent should apply on future similar missions.';

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_memory_select_scoped ON public.agent_memory;
CREATE POLICY agent_memory_select_scoped ON public.agent_memory
  FOR SELECT
  USING (
    public.is_admin()
    OR workspace_id = 'GLOBAL'
    OR workspace_id = public.my_client_id()::text
  );

DROP POLICY IF EXISTS agent_memory_admin_manage ON public.agent_memory;
CREATE POLICY agent_memory_admin_manage ON public.agent_memory
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
