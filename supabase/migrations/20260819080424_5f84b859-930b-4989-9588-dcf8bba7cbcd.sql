CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  _url text := COALESCE(
    current_setting('app.push_url', true),
    'https://project--5306c12d-e1ba-402f-8e1d-dba155762875-dev.lovable.app/api/public/push'
  );
  _secret text := 'f449f586d969abb8b2e59983327c28ad531db365d1b4c477';
begin
  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', _secret
    ),
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
exception when others then
  insert into public.push_log(source_table, status, detail)
  values (TG_TABLE_NAME, 'trigger_error', SQLERRM);
  return NEW;
end;
$function$;

COMMENT ON FUNCTION public.notify_push() IS
  'Fan-out push hook. Set app.push_url via ALTER DATABASE ... SET app.push_url = ''<production>/api/public/push'' for production.';