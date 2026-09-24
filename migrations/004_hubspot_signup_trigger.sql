-- Content Engine - 004_hubspot_signup_trigger.sql
-- Fires on auth.users INSERT and POSTs the new user to the Content Engine
-- worker, which syncs them to HubSpot. (Supabase's "After User Created" auth
-- hook is not yet GA in the dashboard, so we use a pg_net trigger instead.)

create or replace function public.ce_notify_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $ce$
begin
  perform net.http_post(
    url := 'https://content-engine-api.sameerjoshy.workers.dev/auth-hook/after-user-created',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer fnuwleWavLxP13Orb^9RKDQC<4U\`BSc8dpVji_yNThMXHGA'
    ),
    body := jsonb_build_object('user', jsonb_build_object(
      'id', NEW.id::text,
      'email', NEW.email,
      'user_metadata', coalesce(NEW.raw_user_meta_data, '{}'::jsonb)
    )),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$ce$;

drop trigger if exists ce_on_auth_user_created on auth.users;
create trigger ce_on_auth_user_created
after insert on auth.users
for each row
execute function public.ce_notify_user_created();