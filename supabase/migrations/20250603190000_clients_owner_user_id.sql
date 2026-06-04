-- Links each client workspace to the Supabase Auth user provisioned at onboarding
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_owner_user_id_unique
  ON public.clients (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

COMMENT ON COLUMN public.clients.owner_user_id IS
  'Auth user UUID for the client primary contact; set when onboarding from Command Center.';
