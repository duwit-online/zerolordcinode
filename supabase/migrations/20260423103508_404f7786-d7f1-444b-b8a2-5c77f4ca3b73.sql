-- 0. Expand plan_type constraint to allow 'admin_premium'
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_type_check
  CHECK (plan_type = ANY (ARRAY['monthly'::text, 'yearly'::text, 'admin_premium'::text]));

-- 1. Ensure profile exists
INSERT INTO public.profiles (user_id, email, display_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE u.email = 'duwit.online.dev@gmail.com'
ON CONFLICT DO NOTHING;

-- 2. Promote to admin (will also fire the existing trigger to grant premium)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE u.email = 'duwit.online.dev@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Backfill: any admin without active subscription gets one
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

-- 4. Ensure trigger is in place
DROP TRIGGER IF EXISTS on_admin_role_grant_premium ON public.user_roles;
CREATE TRIGGER on_admin_role_grant_premium
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.grant_admin_premium();