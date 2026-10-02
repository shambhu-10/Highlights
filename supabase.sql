-- Run once in the Supabase SQL editor.

create table public.highlights (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  url         text not null,
  title       text,
  quote       text,            -- null = a note on the whole page
  prefix      text,
  suffix      text,
  note        text,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  deleted     boolean not null default false,
  synced_at   timestamptz not null default clock_timestamp()
);

create index highlights_user_synced on public.highlights (user_id, synced_at);

alter table public.highlights enable row level security;

create policy "own highlights" on public.highlights for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.highlights to authenticated;

-- Last write wins on the server too: a stale edit never overwrites a newer one.
-- synced_at is the server's clock, which clients pull by, so device clocks don't matter.
-- ponytail: a pull can miss a row from a still-open transaction stamped earlier; fine for
-- one person's devices, use a sequence + xmin if this ever gets heavy concurrent writes.
create function public.highlights_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

create trigger highlights_touch before insert or update on public.highlights
  for each row execute function public.highlights_touch();
