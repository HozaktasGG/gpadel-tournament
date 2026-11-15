-- Fix: new signups got no profile row, and synced profiles got no player_code.
-- Safe to re-run.
--
-- Cause 1 (no profile at signup): Supabase Auth inserts into auth.users as the role
-- supabase_auth_admin, whose search_path is "auth" only. handle_new_user() called
-- generate_player_code() without a schema, so Postgres looked for auth.generate_player_code(),
-- failed with 42883, and the function's EXCEPTION block swallowed the error.
--
-- Cause 2 (NULL player_code): assign_player_code() exists, but no trigger was attached to
-- public.profiles, and the column has no default. Any insert that does not pass a
-- player_code (the /admin "Sync users" button) therefore stored NULL.

-- ───────────── 1. generate_player_code(): pin search_path, qualify the table ─────────────
-- Body unchanged apart from "public.profiles".

create or replace function public.generate_player_code()
returns text
language plpgsql
set search_path = public
as $function$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := 'SMASH-';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE player_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$function$;

-- ───────────── 2. handle_new_user(): pin search_path, qualify the call ─────────────
-- Name extraction (full_name / name / first_name metadata, else the email local part) is
-- exactly as before. Only changes: SET search_path, and public.generate_player_code().

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
  v_name TEXT;
  v_first TEXT;
  v_last TEXT;
BEGIN
  -- Google'dan gelen name veya full_name'i al
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'first_name', '')
  );

  IF v_name IS NOT NULL AND position(' ' IN v_name) > 0 THEN
    v_first := split_part(v_name, ' ', 1);
    v_last := substr(v_name, position(' ' IN v_name) + 1);
  ELSIF v_name IS NOT NULL THEN
    v_first := v_name;
    v_last := '';
  ELSE
    v_first := split_part(NEW.email, '@', 1);
    v_last := '';
  END IF;

  INSERT INTO public.profiles (
    id, first_name, last_name, email,
    player_code, skill_score, skill_level, is_admin
  )
  VALUES (
    NEW.id, v_first, v_last, NEW.email,
    public.generate_player_code(), 0, 'Unranked', false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- The existing trigger on_auth_user_created (AFTER INSERT ON auth.users) is left untouched;
-- it keeps calling this function.

-- ───────────── 3. assign_player_code(): pin search_path, attach it to profiles ─────────────
-- Fills player_code only when the insert left it NULL, so it never overrides the code
-- handle_new_user() already passes — the two cannot conflict.

create or replace function public.assign_player_code()
returns trigger
language plpgsql
set search_path = public
as $function$
BEGIN
  IF NEW.player_code IS NULL THEN
    NEW.player_code := public.generate_player_code();
  END IF;
  RETURN NEW;
END;
$function$;

drop trigger if exists assign_player_code_on_insert on public.profiles;
create trigger assign_player_code_on_insert
  before insert on public.profiles
  for each row execute function public.assign_player_code();

-- ───────────── 4. Backfill existing profiles without a code ─────────────
-- One row at a time, so every new code is checked against the ones just written.
-- Touches only rows where player_code IS NULL; a second run finds none.

do $$
declare
  r record;
begin
  for r in select id from public.profiles where player_code is null order by created_at loop
    update public.profiles
      set player_code = public.generate_player_code()
      where id = r.id and player_code is null;
  end loop;
end;
$$;
