-- Registration open/close flag for events. Safe to re-run.

alter table public.events
  add column if not exists registration_open boolean not null default true;

-- Block end-user inserts into event_registrations while registration is closed.
-- Only requests made with an end-user JWT (anon / authenticated) are checked:
-- admin Server Actions (service_role key) and the SQL Editor are not affected.
create or replace function public.enforce_event_registration_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if exists (
    select 1 from public.events e
    where e.id = new.event_id and e.registration_open = false
  ) then
    raise exception 'Registrations are closed for this event.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists event_registrations_require_open on public.event_registrations;

create trigger event_registrations_require_open
  before insert on public.event_registrations
  for each row
  execute function public.enforce_event_registration_open();
