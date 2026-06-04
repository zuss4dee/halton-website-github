-- Profiles link auth.users to admin vs client workspace access
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'client')),
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_client_role_check CHECK (
    (role = 'admin' AND client_id IS NULL)
    OR (role = 'client' AND client_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.profiles IS 'Maps Supabase Auth users to admin Command Center or a single client workspace.';

CREATE INDEX IF NOT EXISTS profiles_client_id_idx ON public.profiles (client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Auto-provision client profiles when email matches clients.primary_contact_email
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_client_id uuid;
BEGIN
  SELECT c.id
  INTO matched_client_id
  FROM public.clients c
  WHERE c.primary_contact_email IS NOT NULL
    AND lower(trim(c.primary_contact_email)) = lower(trim(NEW.email))
  ORDER BY c.created_at DESC NULLS LAST
  LIMIT 1;

  IF matched_client_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, role, client_id)
    VALUES (NEW.id, 'client', matched_client_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role = 'client'
  LIMIT 1;
$$;

-- Client-scoped read access for workspace terminal (admins retain full read)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select_scoped ON public.clients;
CREATE POLICY clients_select_scoped ON public.clients
  FOR SELECT
  USING (
    public.is_admin()
    OR id = public.my_client_id()
  );

DROP POLICY IF EXISTS clients_admin_manage ON public.clients;
CREATE POLICY clients_admin_manage ON public.clients
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select_scoped ON public.leads;
CREATE POLICY leads_select_scoped ON public.leads
  FOR SELECT
  USING (
    public.is_admin()
    OR client_id = public.my_client_id()
  );

DROP POLICY IF EXISTS leads_admin_manage ON public.leads;
CREATE POLICY leads_admin_manage ON public.leads
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS replies_select_all ON public.replies;
DROP POLICY IF EXISTS replies_select_scoped ON public.replies;

CREATE POLICY replies_select_scoped ON public.replies
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = replies.lead_id
        AND l.client_id = public.my_client_id()
    )
  );
