-- Remove empty test circles created before 2026-09-20 (no visits recorded)
with doomed as (
  select c.id from public.family_circles c
  where c.created_at < '2026-09-20'
    and not exists (select 1 from public.visits v where v.family_circle_id = c.id)
)
, d1 as (delete from public.planned_visits where family_circle_id in (select id from doomed))
, d2 as (delete from public.messages where family_circle_id in (select id from doomed))
, d3 as (delete from public.invitations where family_circle_id in (select id from doomed))
, d4 as (delete from public.circle_bans where family_circle_id in (select id from doomed))
, d5 as (delete from public.family_members where family_circle_id in (select id from doomed))
, d6 as (delete from public.persons where family_circle_id in (select id from doomed))
delete from public.family_circles where id in (select id from doomed);