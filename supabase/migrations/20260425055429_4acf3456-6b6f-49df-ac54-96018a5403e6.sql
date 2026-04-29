-- Restore new-user profile/trial automation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Restore automatic admin premium automation
DROP TRIGGER IF EXISTS on_admin_role_grant_premium ON public.user_roles;
CREATE TRIGGER on_admin_role_grant_premium
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_admin_premium();

-- Restore updated-at automation for editable legal pages when present
DO $$
BEGIN
  IF to_regclass('public.static_pages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_static_pages_updated_at ON public.static_pages;
    CREATE TRIGGER update_static_pages_updated_at
      BEFORE UPDATE ON public.static_pages
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Backfill profiles for accounts that already exist but were not synced
INSERT INTO public.profiles (user_id, email, display_name, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    updated_at = now();

-- Keep trial settings visible/enabled by default unless the admin changes it again
INSERT INTO public.app_settings (key, value)
VALUES (
  'trial_settings',
  '{"enabled": true, "days": 1, "note": "Welcome to Cinode! You have a free trial. Upgrade anytime to keep enjoying premium content.", "show_notification": true, "show_modal": true, "show_banner": true}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.app_settings.value, '{}'::jsonb)
  || jsonb_build_object(
    'enabled', COALESCE((public.app_settings.value->>'enabled')::boolean, true),
    'days', GREATEST(COALESCE((public.app_settings.value->>'days')::integer, 1), 1),
    'note', COALESCE(NULLIF(public.app_settings.value->>'note', ''), 'Welcome to Cinode! You have a free trial. Upgrade anytime to keep enjoying premium content.'),
    'show_notification', COALESCE((public.app_settings.value->>'show_notification')::boolean, true),
    'show_modal', COALESCE((public.app_settings.value->>'show_modal')::boolean, true),
    'show_banner', COALESCE((public.app_settings.value->>'show_banner')::boolean, true)
  ),
  updated_at = now();

-- Ensure legal page defaults exist
INSERT INTO public.static_pages (slug, title, content, is_published, show_in_footer, sort_order)
VALUES
  ('privacy', 'Privacy Policy', '<h1>Privacy Policy</h1><p>Update this page from Admin → Pages.</p>', true, true, 10),
  ('terms', 'Terms of Use', '<h1>Terms of Use</h1><p>Update this page from Admin → Pages.</p>', true, true, 20),
  ('contact', 'Contact', '<h1>Contact</h1><p>Update this page from Admin → Pages.</p>', true, true, 30)
ON CONFLICT (slug) DO NOTHING;

-- Give premium access to existing admins if missing
INSERT INTO public.subscriptions (user_id, plan_type, status, starts_at, expires_at)
SELECT ur.user_id, 'admin_premium', 'active', now(), now() + interval '10 years'
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = ur.user_id
      AND s.status = 'active'
      AND s.expires_at > now()
  );