CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('beenby-cleanup-chat-images')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'beenby-cleanup-chat-images');

SELECT cron.schedule(
  'beenby-cleanup-chat-images',
  '17 3 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      current_setting('app.push_url', true),
      'https://project--5306c12d-e1ba-402f-8e1d-dba155762875-dev.lovable.app/api/public/push'
    ) || '',
    headers := '{}'::jsonb
  ) WHERE false;
  $$
);