SELECT cron.unschedule('beenby-cleanup-chat-images');

SELECT cron.schedule(
  'beenby-cleanup-chat-images',
  '17 3 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      current_setting('app.cleanup_url', true),
      'https://project--5306c12d-e1ba-402f-8e1d-dba155762875-dev.lovable.app/api/public/cleanup-chat-images'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', 'f449f586d969abb8b2e59983327c28ad531db365d1b4c477'
    ),
    body := '{}'::jsonb
  );
  $$
);