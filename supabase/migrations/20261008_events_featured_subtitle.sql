-- Featured flag + optional subtitle for events (UI redesign). Safe to re-run.

alter table public.events
  add column if not exists featured boolean not null default false;

alter table public.events
  add column if not exists subtitle text;
