-- Onboard form fields for Command Center client provisioning
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS sending_domain text;

COMMENT ON COLUMN public.clients.primary_contact_email IS
  'Primary contact email captured at workspace onboarding.';
COMMENT ON COLUMN public.clients.sending_domain IS
  'Outbound sending domain (e.g. mail.client.com) provisioned for Resend.';
