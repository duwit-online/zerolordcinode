INSERT INTO public.app_settings (key, value)
VALUES 
  ('playback_order', '{"order":["jellyfin_direct","jellyfin_hls","override","vidsrc","vidsrc_xyz","2embed","superembed","vidlink","smashy"]}'::jsonb),
  ('mobile_app_links', '{"android":"","ios":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;