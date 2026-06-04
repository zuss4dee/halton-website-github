-- Allow admin UI (anon client) to read inbound reply bodies for the dashboard drawer
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS replies_select_all ON public.replies;

CREATE POLICY replies_select_all ON public.replies
  FOR SELECT
  USING (true);
