update public.profiles set name='Simon' where id='c39865c5-5c62-42b7-be65-5af5d08487dd';

insert into public.visits (family_circle_id, user_id, person_id, visited_at, local_day, source)
select 'dd397978-1afd-4f72-b904-1a8b2fa18bd4', v.uid::uuid, (select id from public.persons where family_circle_id='dd397978-1afd-4f72-b904-1a8b2fa18bd4' limit 1),
       (current_date - v.d)::timestamptz + interval '15 hours', (current_date - v.d), 'manual'
from (values
 ('c39865c5-5c62-42b7-be65-5af5d08487dd', 3),
 ('e6663feb-13df-45f8-ba88-84edf4c3812c', 6),
 ('bd56262c-cb97-42f4-b736-c6ee65833aaa', 9),
 ('c39865c5-5c62-42b7-be65-5af5d08487dd', 13),
 ('e6663feb-13df-45f8-ba88-84edf4c3812c', 17),
 ('bd56262c-cb97-42f4-b736-c6ee65833aaa', 21)
) as v(uid, d);

insert into public.planned_visits (family_circle_id, user_id, person_id, planned_date, status)
select 'dd397978-1afd-4f72-b904-1a8b2fa18bd4', 'e6663feb-13df-45f8-ba88-84edf4c3812c', (select id from public.persons where family_circle_id='dd397978-1afd-4f72-b904-1a8b2fa18bd4' limit 1), (current_date + 4), 'planned';