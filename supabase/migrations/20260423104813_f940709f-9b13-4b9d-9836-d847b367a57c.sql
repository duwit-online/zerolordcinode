ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_type_check
  CHECK (plan_type = ANY (ARRAY['monthly'::text, 'yearly'::text, 'admin_premium'::text, 'trial'::text]));

INSERT INTO public.app_settings (key, value)
VALUES (
  'trial_settings',
  jsonb_build_object(
    'enabled', false,
    'days', 1,
    'note', 'Welcome! You have a free trial.',
    'show_sticky', true,
    'show_modal', true,
    'show_notification', true
  )
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trial_settings jsonb;
  trial_enabled boolean;
  trial_days integer;
  trial_note text;
  show_notification boolean;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
      updated_at = now();

  SELECT value INTO trial_settings
  FROM public.app_settings
  WHERE key = 'trial_settings'
  LIMIT 1;

  trial_enabled := COALESCE((trial_settings->>'enabled')::boolean, false);
  trial_days := GREATEST(COALESCE((trial_settings->>'days')::integer, 0), 0);
  trial_note := NULLIF(BTRIM(COALESCE(trial_settings->>'note', '')), '');
  show_notification := COALESCE((trial_settings->>'show_notification')::boolean, true);

  IF trial_enabled AND trial_days > 0 THEN
    INSERT INTO public.subscriptions (user_id, plan_type, status, starts_at, expires_at)
    VALUES (NEW.id, 'trial', 'active', now(), now() + make_interval(days => trial_days))
    ON CONFLICT DO NOTHING;

    IF show_notification AND trial_note IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, target_user_id, target, title, message, type)
      VALUES (NEW.id, NEW.id, 'single', 'Free Trial Activated', trial_note, 'info');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;