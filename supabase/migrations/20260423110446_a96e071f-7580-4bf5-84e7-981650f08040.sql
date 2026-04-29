
-- 1. Backfill profiles for existing auth users that don't have one
INSERT INTO public.profiles (user_id, email, display_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. Attach the handle_new_user trigger to auth.users (this is what was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Add notifications table to realtime publication for live updates
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- 4. Create static_pages table for editable legal pages (Privacy, Terms, etc.)
CREATE TABLE IF NOT EXISTS public.static_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  show_in_footer boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.static_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published static pages" ON public.static_pages;
CREATE POLICY "Anyone can read published static pages" ON public.static_pages
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage static pages" ON public.static_pages;
CREATE POLICY "Admins manage static pages" ON public.static_pages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_static_pages_updated_at ON public.static_pages;
CREATE TRIGGER update_static_pages_updated_at
  BEFORE UPDATE ON public.static_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.static_pages (slug, title, content, sort_order) VALUES
  ('privacy', 'Privacy Policy', '<h1>Privacy Policy</h1><p>Edit this page from the admin dashboard to describe how you collect and use user data.</p>', 1),
  ('terms', 'Terms of Use', '<h1>Terms of Use</h1><p>Edit this page from the admin dashboard to describe the rules for using your service.</p>', 2),
  ('about', 'About Us', '<h1>About Cinode</h1><p>Edit this page from the admin dashboard.</p>', 3)
ON CONFLICT (slug) DO NOTHING;

-- 5. Track whether a user accepted terms at signup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_acknowledged boolean NOT NULL DEFAULT false;

-- 6. Make sure trial_settings exists with sensible defaults
INSERT INTO public.app_settings (key, value)
VALUES (
  'trial_settings',
  '{"enabled": true, "days": 1, "note": "Welcome to Cinode! You have a free trial. Upgrade anytime to continue enjoying premium content.", "show_notification": true, "show_modal": true, "show_banner": true}'::jsonb
)
ON CONFLICT (key) DO UPDATE
  SET value = public.app_settings.value || jsonb_build_object(
    'enabled', COALESCE(public.app_settings.value->'enabled', 'true'::jsonb),
    'days', COALESCE(public.app_settings.value->'days', '1'::jsonb),
    'note', COALESCE(public.app_settings.value->'note', '"Welcome to Cinode! You have a free trial."'::jsonb),
    'show_notification', COALESCE(public.app_settings.value->'show_notification', 'true'::jsonb),
    'show_modal', COALESCE(public.app_settings.value->'show_modal', 'true'::jsonb),
    'show_banner', COALESCE(public.app_settings.value->'show_banner', 'true'::jsonb)
  );
