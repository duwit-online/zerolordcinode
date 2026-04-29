
-- 1. Make duwit.online.dev@gmail.com an admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE p.email = 'duwit.online.dev@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Grant premium subscription to all existing admins (10 years)
INSERT INTO public.subscriptions (user_id, plan_type, status, expires_at)
SELECT ur.user_id, 'admin_premium', 'active', now() + interval '10 years'
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = ur.user_id
      AND s.status = 'active'
      AND s.expires_at > now()
  );

-- 3. Trigger: when someone becomes admin, auto-grant premium subscription
CREATE OR REPLACE FUNCTION public.grant_admin_premium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND expires_at > now()
    ) THEN
      INSERT INTO public.subscriptions (user_id, plan_type, status, expires_at)
      VALUES (NEW.user_id, 'admin_premium', 'active', now() + interval '10 years');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_role_grant_premium ON public.user_roles;
CREATE TRIGGER on_admin_role_grant_premium
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.grant_admin_premium();
