
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- family circles
CREATE TABLE public.family_circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Stockholm',
  family_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(encode(gen_random_bytes(9),'base64'),'/','X'), 1, 6)),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.family_circles TO authenticated;
GRANT ALL ON public.family_circles TO service_role;
ALTER TABLE public.family_circles ENABLE ROW LEVEL SECURITY;

-- family members
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  personal_color text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_circle_id, user_id),
  UNIQUE (family_circle_id, personal_color)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_circle_member(_circle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_circle_id = _circle AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_circle_creator(_circle uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_circles c WHERE c.id = _circle AND c.created_by = auth.uid());
$$;

CREATE POLICY "members read circle" ON public.family_circles FOR SELECT TO authenticated
  USING (public.is_circle_member(id) OR created_by = auth.uid());
CREATE POLICY "create circle" ON public.family_circles FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "members update circle" ON public.family_circles FOR UPDATE TO authenticated
  USING (public.is_circle_member(id)) WITH CHECK (public.is_circle_member(id));

CREATE POLICY "members read members" ON public.family_members FOR SELECT TO authenticated
  USING (public.is_circle_member(family_circle_id));
CREATE POLICY "join own membership" ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_circle_creator(family_circle_id) OR public.is_circle_member(family_circle_id)));
CREATE POLICY "update own membership" ON public.family_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "leave circle" ON public.family_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- member profile names visible inside the circle
CREATE OR REPLACE FUNCTION public.circle_member_names(_circle uuid)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name FROM public.profiles p
  JOIN public.family_members m ON m.user_id = p.id
  WHERE m.family_circle_id = _circle AND public.is_circle_member(_circle);
$$;
GRANT EXECUTE ON FUNCTION public.circle_member_names(uuid) TO authenticated;

-- persons visited
CREATE TABLE public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_latitude double precision,
  location_longitude double precision,
  geofence_radius integer NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.persons TO authenticated;
GRANT ALL ON public.persons TO service_role;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read persons" ON public.persons FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));
CREATE POLICY "members write persons" ON public.persons FOR INSERT TO authenticated
  WITH CHECK (public.is_circle_member(family_circle_id) OR public.is_circle_creator(family_circle_id));
CREATE POLICY "members update persons" ON public.persons FOR UPDATE TO authenticated
  USING (public.is_circle_member(family_circle_id)) WITH CHECK (public.is_circle_member(family_circle_id));

-- visits
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  visited_at timestamptz NOT NULL DEFAULT now(),
  local_day date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  client_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, user_id, client_token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read visits" ON public.visits FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));
CREATE POLICY "insert own visits" ON public.visits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_circle_member(family_circle_id));
CREATE POLICY "update own visits" ON public.visits FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own visits" ON public.visits FOR DELETE TO authenticated USING (user_id = auth.uid());

-- planned visits
CREATE TABLE public.planned_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  planned_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_visits TO authenticated;
GRANT ALL ON public.planned_visits TO service_role;
ALTER TABLE public.planned_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read planned" ON public.planned_visits FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));
CREATE POLICY "insert own planned" ON public.planned_visits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_circle_member(family_circle_id));
CREATE POLICY "update own planned" ON public.planned_visits FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own planned" ON public.planned_visits FOR DELETE TO authenticated USING (user_id = auth.uid());

-- invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read invitations" ON public.invitations FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));
CREATE POLICY "members create invitations" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_circle_member(family_circle_id));

-- preview an invite (token or family code) without being a member
CREATE OR REPLACE FUNCTION public.preview_invite(_token text DEFAULT NULL, _code text DEFAULT NULL)
RETURNS TABLE (circle_id uuid, circle_name text, person_name text, taken_colors text[], status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.family_circles%ROWTYPE; inv public.invitations%ROWTYPE;
BEGIN
  IF _token IS NOT NULL THEN
    SELECT * INTO inv FROM public.invitations WHERE invite_token = _token;
    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
    END IF;
    IF inv.expires_at < now() THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'expired'::text; RETURN;
    END IF;
    SELECT * INTO c FROM public.family_circles WHERE id = inv.family_circle_id;
  ELSIF _code IS NOT NULL THEN
    SELECT * INTO c FROM public.family_circles WHERE family_code = upper(trim(_code));
    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
    END IF;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text[], 'invalid'::text; RETURN;
  END IF;

  RETURN QUERY SELECT c.id, c.name,
    (SELECT p.name FROM public.persons p WHERE p.family_circle_id = c.id ORDER BY p.created_at LIMIT 1),
    COALESCE((SELECT array_agg(m.personal_color) FROM public.family_members m WHERE m.family_circle_id = c.id), '{}'::text[]),
    'ok'::text;
END; $$;
GRANT EXECUTE ON FUNCTION public.preview_invite(text, text) TO authenticated;

-- join a circle via token or family code
CREATE OR REPLACE FUNCTION public.join_circle(_name text, _color text, _token text DEFAULT NULL, _code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c_id uuid; inv public.invitations%ROWTYPE; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _token IS NOT NULL THEN
    SELECT * INTO inv FROM public.invitations WHERE invite_token = _token;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_invite'; END IF;
    IF inv.expires_at < now() THEN RAISE EXCEPTION 'expired_invite'; END IF;
    c_id := inv.family_circle_id;
    UPDATE public.invitations SET used_at = COALESCE(used_at, now()) WHERE id = inv.id;
  ELSIF _code IS NOT NULL THEN
    SELECT id INTO c_id FROM public.family_circles WHERE family_code = upper(trim(_code));
    IF c_id IS NULL THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  ELSE
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  UPDATE public.profiles SET name = _name WHERE id = uid AND coalesce(_name,'') <> '';

  INSERT INTO public.family_members (family_circle_id, user_id, personal_color)
  VALUES (c_id, uid, _color)
  ON CONFLICT (family_circle_id, user_id) DO UPDATE SET personal_color = EXCLUDED.personal_color;

  RETURN c_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.join_circle(text, text, text, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.planned_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.persons;
