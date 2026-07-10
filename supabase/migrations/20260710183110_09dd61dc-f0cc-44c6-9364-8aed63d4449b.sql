CREATE TABLE public.jellyfin_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  jellyfin_user_id text NOT NULL,
  jellyfin_username text NOT NULL,
  access_token_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.jellyfin_user_links TO authenticated;
GRANT ALL ON public.jellyfin_user_links TO service_role;

ALTER TABLE public.jellyfin_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own jellyfin link"
  ON public.jellyfin_user_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all jellyfin links"
  ON public.jellyfin_user_links FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_jellyfin_user_links_updated
  BEFORE UPDATE ON public.jellyfin_user_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();