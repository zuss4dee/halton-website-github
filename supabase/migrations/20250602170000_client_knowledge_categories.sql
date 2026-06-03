-- Extend client_knowledge category values for vault UI
ALTER TABLE public.client_knowledge
  DROP CONSTRAINT IF EXISTS client_knowledge_category_check;

ALTER TABLE public.client_knowledge
  ADD CONSTRAINT client_knowledge_category_check
  CHECK (
    category IN (
      'brand_voice',
      'case_study',
      'core_offer',
      'objection_handling',
      'general'
    )
  );

CREATE INDEX IF NOT EXISTS client_knowledge_client_id_idx
  ON public.client_knowledge (client_id, created_at DESC);

COMMENT ON TABLE public.client_knowledge IS
  'Workspace-scoped RAG knowledge for CEO search_client_knowledge and manual vault UI.';
