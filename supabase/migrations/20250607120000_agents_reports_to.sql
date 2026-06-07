-- Self-referencing reporting chain for workspace agent org chart
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS reports_to_agent_id uuid REFERENCES public.agents (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS agents_reports_to_agent_id_idx
  ON public.agents (reports_to_agent_id)
  WHERE reports_to_agent_id IS NOT NULL;

COMMENT ON COLUMN public.agents.reports_to_agent_id IS
  'Parent agent in the workspace reporting chain (typically the CEO). NULL for root agents.';

-- Backfill: workspace sub-agents report to their CEO
UPDATE public.agents AS sub
SET reports_to_agent_id = ceo.id
FROM public.agents AS ceo
WHERE sub.client_id IS NOT NULL
  AND sub.client_id = ceo.client_id
  AND ceo.role = 'CEO'
  AND sub.role <> 'CEO'
  AND sub.reports_to_agent_id IS NULL;

-- Client workspace read access + admin management
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agents_select_scoped ON public.agents;
CREATE POLICY agents_select_scoped ON public.agents
  FOR SELECT
  USING (
    public.is_admin()
    OR client_id = public.my_client_id()
  );

DROP POLICY IF EXISTS agents_admin_manage ON public.agents;
CREATE POLICY agents_admin_manage ON public.agents
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Realtime updates for org chart / roster
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
  END IF;
END
$$;
