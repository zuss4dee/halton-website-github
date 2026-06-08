-- Workspace-level automated sequence run control (Sequence Builder pause/stop)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sequence_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_sequence_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_sequence_status_check
  CHECK (sequence_status IN ('active', 'paused', 'stopped'));

COMMENT ON COLUMN public.clients.sequence_status IS
  'Automated sequence runner: active | paused | stopped (stopped is irreversible).';
