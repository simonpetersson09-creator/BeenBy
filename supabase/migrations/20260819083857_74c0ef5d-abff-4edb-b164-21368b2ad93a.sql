-- Push: HMAC-signed calls, per-circle burst throttling, blocked-attempt logging
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
  _circle uuid := NEW.family_circle_id;
  _ts text := (extract(epoch from now()))::bigint::text;
  _sig text;
begin
  -- Abuse protection: stop abnormal bursts, allow normal active family chat.
  if not public.consume_rate_limit('push_circle_burst', 120, 300, _circle) then
    insert into public.push_log(source_table, status, detail)
    values (TG_TABLE_NAME, 'throttled', 'circle burst limit');
    return NEW;
  end if;
  if not public.consume_rate_limit('push_circle_day', 3000, 86400, _circle) then
    insert into public.push_log(source_table, status, detail)
    values (TG_TABLE_NAME, 'throttled', 'circle daily limit');
    return NEW;
  end if;

  _sig := encode(
    extensions.hmac(_ts || '.' || TG_TABLE_NAME || '.' || NEW.id::text, _secret, 'sha256'),
    'hex'
  );

  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', _secret,
      'x-push-ts', _ts,
      'x-push-id', NEW.id::text,
      'x-push-sig', _sig
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

-- Invite preview: brute-force protection (must be VOLATILE to record attempts)
CREATE OR REPLACE FUNCTION public.preview_invite(_token text DEFAULT NULL::text, _code text DEFAULT NULL::text)
 RETURNS TABLE(circle_id uuid, circle_name text, person_name text, taken_colors text[], status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.family_circles%ROWTYPE; inv public.invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
  END IF;
  IF NOT public.consume_rate_limit('invite_preview_min', 10, 60, auth.uid())
     OR NOT public.consume_rate_limit('invite_preview_hour', 60, 3600, auth.uid())
     OR NOT public.consume_rate_limit('invite_preview_day', 200, 86400, auth.uid()) THEN
    PERFORM public.log_security_event('invite_bruteforce', 'preview_invite rate limit', auth.uid());
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'rate_limited'::text; RETURN;
  END IF;

  IF _token IS NOT NULL THEN
    SELECT * INTO inv FROM public.invitations WHERE invite_token = _token;
    IF NOT FOUND THEN
      PERFORM public.log_security_event('invite_failed', 'token', auth.uid());
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
    END IF;
    IF inv.expires_at < now() THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'expired'::text; RETURN;
    END IF;
    SELECT * INTO c FROM public.family_circles WHERE id = inv.family_circle_id;
  ELSIF _code IS NOT NULL THEN
    SELECT * INTO c FROM public.family_circles WHERE family_code = upper(trim(_code));
    IF NOT FOUND THEN
      PERFORM public.log_security_event('invite_failed', 'code', auth.uid());
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
    END IF;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
  END IF;

  RETURN QUERY SELECT c.id, c.name,
    (SELECT p.name FROM public.persons p WHERE p.family_circle_id = c.id ORDER BY p.created_at LIMIT 1),
    COALESCE((SELECT array_agg(m.personal_color) FROM public.family_members m WHERE m.family_circle_id = c.id), '{}'::text[]),
    'ok'::text;
END; $function$;

-- Join: brute-force protection + logging
CREATE OR REPLACE FUNCTION public.join_circle(_name text, _color text, _token text DEFAULT NULL::text, _code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_id uuid;
  inv public.invitations%ROWTYPE;
  uid uuid := auth.uid();
  chosen text;
  palette text[] := ARRAY['blue','green','orange','purple','terracotta','teal','pink','sand'];
  candidate text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF NOT public.consume_rate_limit('join_min', 5, 60, uid)
     OR NOT public.consume_rate_limit('join_hour', 20, 3600, uid)
     OR NOT public.consume_rate_limit('join_day', 60, 86400, uid) THEN
    PERFORM public.log_security_event('invite_bruteforce', 'join_circle rate limit', uid);
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF coalesce(char_length(_name), 0) > 100 OR coalesce(char_length(_color), 0) > 40 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  IF _token IS NOT NULL THEN
    SELECT * INTO inv FROM public.invitations WHERE invite_token = _token;
    IF NOT FOUND THEN
      PERFORM public.log_security_event('invite_failed', 'join token', uid);
      RAISE EXCEPTION 'invalid_invite';
    END IF;
    IF inv.expires_at < now() THEN RAISE EXCEPTION 'expired_invite'; END IF;
    c_id := inv.family_circle_id;
    UPDATE public.invitations SET used_at = COALESCE(used_at, now()) WHERE id = inv.id;
  ELSIF _code IS NOT NULL THEN
    SELECT id INTO c_id FROM public.family_circles WHERE family_code = upper(trim(_code));
    IF c_id IS NULL THEN
      PERFORM public.log_security_event('invite_failed', 'join code', uid);
      RAISE EXCEPTION 'invalid_invite';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  UPDATE public.profiles SET name = _name WHERE id = uid AND coalesce(_name,'') <> '';

  chosen := _color;
  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_circle_id = c_id AND personal_color = chosen AND user_id <> uid
  ) THEN
    chosen := NULL;
    FOREACH candidate IN ARRAY palette LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_circle_id = c_id AND personal_color = candidate
      ) THEN
        chosen := candidate;
        EXIT;
      END IF;
    END LOOP;
    IF chosen IS NULL THEN
      chosen := _color || '-' || substr(uid::text, 1, 4);
    END IF;
  END IF;

  INSERT INTO public.family_members (family_circle_id, user_id, personal_color)
  VALUES (c_id, uid, chosen)
  ON CONFLICT (family_circle_id, user_id) DO UPDATE SET personal_color = EXCLUDED.personal_color;

  RETURN c_id;
END; $function$;

-- Orphaned chat images (uploaded but never attached to a message)
CREATE OR REPLACE FUNCTION public.orphan_chat_images(_older_than_hours integer DEFAULT 24, _limit integer DEFAULT 500)
RETURNS TABLE(object_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'chat-images'
    AND o.created_at < now() - make_interval(hours => _older_than_hours)
    AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.image_path = o.name)
  LIMIT least(_limit, 1000);
$$;
REVOKE ALL ON FUNCTION public.orphan_chat_images(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orphan_chat_images(integer, integer) TO service_role;

-- Trigger functions must never be callable through the API
REVOKE ALL ON FUNCTION public.guard_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_visits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_planned_visits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invitations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_circles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_persons() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_device_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trim_device_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_trial_on_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_trial_started_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_family_code() FROM PUBLIC, anon, authenticated;