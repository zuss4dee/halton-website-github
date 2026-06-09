-- Allow approval_gate queue inserts when CRM/Apollo company is unavailable (test dispatches).
ALTER TABLE public.leads
  ALTER COLUMN target_company DROP NOT NULL;
