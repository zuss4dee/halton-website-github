-- Agent Studio: model tuning, tool bindings, reasoning config
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS temperature real NOT NULL DEFAULT 0.7;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS tool_bindings jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS reasoning_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill tool_bindings from legacy skills column
UPDATE public.agents
SET tool_bindings = skills
WHERE jsonb_array_length(tool_bindings) = 0
  AND jsonb_typeof(skills) = 'array'
  AND jsonb_array_length(skills) > 0;

COMMENT ON COLUMN public.agents.temperature IS 'LLM sampling temperature (0–2).';
COMMENT ON COLUMN public.agents.tool_bindings IS 'Attached global tool/skill ids for this agent.';
COMMENT ON COLUMN public.agents.reasoning_config IS 'Advanced reasoning JSON (instructions, top_p, max_tokens, etc.).';
