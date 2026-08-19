ALTER TABLE public.visits DISABLE TRIGGER USER;
ALTER TABLE public.planned_visits DISABLE TRIGGER USER;
ALTER TABLE public.messages DISABLE TRIGGER USER;
DO $$
DECLARE
  rec RECORD;
  cid uuid; pid uuid; m uuid[]; d int; i int;
  offs int[] := ARRAY[1,2,4,6,9,11,14,17,20,24,27];
  acts text[] := ARRAY['greet','shop','meds','home','care'];
BEGIN
FOR rec IN
  SELECT * FROM (VALUES
   ('LU8MDR','Jag var hos mamma i morse, hon var på strålande humör ☺️','Vad fint! Jag tar tisdag nästa vecka.','Jag handlar åt henne på fredag.'),
   ('9C4TJQ','Popped in this morning, mum was in great spirits ☺️','Lovely! I''ll take Tuesday next week.','I''ll do her shopping on Friday.'),
   ('3JM9PV','War heute früh bei Mama, sie war bester Laune ☺️','Schön! Ich übernehme nächsten Dienstag.','Ich erledige Freitag ihren Einkauf.'),
   ('2V9PD3','Var forbi mor i morges, hun var i godt humør ☺️','Hvor dejligt! Jeg tager tirsdag i næste uge.','Jeg handler for hende på fredag.'),
   ('V4FPPL','Kävin äidin luona aamulla, hän oli hyvällä tuulella ☺️','Ihanaa! Minä menen ensi tiistaina.','Käyn kaupassa hänen puolestaan perjantaina.'),
   ('ZKJ87Y','Pasé a ver a mamá esta mañana, estaba de muy buen humor ☺️','¡Qué bien! Yo voy el martes que viene.','El viernes le hago la compra.'),
   ('H74Z95','Je suis passé voir maman ce matin, elle était de très bonne humeur ☺️','Super ! Je prends mardi prochain.','Je fais ses courses vendredi.')
  ) AS v(code, m1, m2, m3)
LOOP
  SELECT id INTO cid FROM public.family_circles WHERE family_code = rec.code;
  CONTINUE WHEN cid IS NULL;
  SELECT id INTO pid FROM public.persons WHERE family_circle_id = cid LIMIT 1;
  SELECT array_agg(user_id ORDER BY joined_at) INTO m FROM public.family_members WHERE family_circle_id = cid;

  DELETE FROM public.visits WHERE family_circle_id = cid;
  DELETE FROM public.planned_visits WHERE family_circle_id = cid;
  DELETE FROM public.messages WHERE family_circle_id = cid;

  FOR i IN 1..array_length(offs,1) LOOP
    d := offs[i];
    INSERT INTO public.visits (family_circle_id, person_id, user_id, local_day, visited_at, source, activities)
    VALUES (cid, pid, m[1 + (i % array_length(m,1))], (current_date - d),
            (current_date - d)::timestamptz + interval '14 hours', 'manual', ARRAY[acts[1 + (i % 5)]]);
  END LOOP;
  INSERT INTO public.visits (family_circle_id, person_id, user_id, local_day, visited_at, source, activities)
  VALUES (cid, pid, m[1], current_date, now() - interval '3 hours', 'manual', ARRAY['greet','shop']);

  INSERT INTO public.planned_visits (family_circle_id, person_id, user_id, planned_date, status, activities)
  VALUES (cid, pid, m[2], (current_date + 2), 'planned', ARRAY['greet']),
         (cid, pid, m[3], (current_date + 5), 'planned', ARRAY['shop']),
         (cid, pid, m[1], (current_date + 9), 'planned', ARRAY['meds']);

  INSERT INTO public.messages (family_circle_id, user_id, body, created_at) VALUES
    (cid, m[2], rec.m1, now() - interval '5 hours'),
    (cid, m[1], rec.m2, now() - interval '4 hours'),
    (cid, m[3], rec.m3, now() - interval '2 hours');
END LOOP;
END $$;
ALTER TABLE public.visits ENABLE TRIGGER USER;
ALTER TABLE public.planned_visits ENABLE TRIGGER USER;
ALTER TABLE public.messages ENABLE TRIGGER USER;