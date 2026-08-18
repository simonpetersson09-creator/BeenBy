create extension if not exists pg_net with schema extensions;

create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios',
  locale text not null default 'sv',
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.device_tokens to authenticated;
grant all on public.device_tokens to service_role;

alter table public.device_tokens enable row level security;

drop policy if exists "own device tokens" on public.device_tokens;
create policy "own device tokens" on public.device_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _url text := 'https://project--5306c12d-e1ba-402f-8e1d-dba155762875.lovable.app/api/public/push';
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
  return NEW;
end;
$$;

revoke all on function public.notify_push() from public, anon, authenticated;

drop trigger if exists trg_push_messages on public.messages;
create trigger trg_push_messages after insert on public.messages
  for each row execute function public.notify_push();

drop trigger if exists trg_push_members on public.family_members;
create trigger trg_push_members after insert on public.family_members
  for each row execute function public.notify_push();

drop trigger if exists trg_push_visits on public.visits;
create trigger trg_push_visits after insert on public.visits
  for each row execute function public.notify_push();

drop trigger if exists trg_push_planned on public.planned_visits;
create trigger trg_push_planned after insert on public.planned_visits
  for each row execute function public.notify_push();