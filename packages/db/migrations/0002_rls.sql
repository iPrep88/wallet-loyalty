-- Row Level Security.
--
-- These policies only matter once owner auth exists (Phase 4). Until then every
-- query runs through server-side route handlers on a privileged connection,
-- which bypasses RLS exactly the way Supabase's service role does. The policies
-- are written now so that turning auth on is a configuration change, not a
-- schema migration.

-- Local Postgres has no auth schema. Supabase does — and its auth.uid() must
-- NOT be clobbered, so only create a shim when one is genuinely absent.
create schema if not exists auth;

do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable as $body$
        select nullif(
          current_setting('request.jwt.claim.sub', true), ''
        )::uuid
      $body$
    $fn$;
  end if;
end $$;

alter table businesses         enable row level security;
alter table programs           enable row level security;
alter table members            enable row level security;
alter table staff              enable row level security;
alter table stamp_events       enable row level security;
alter table broadcasts         enable row level security;
alter table apple_registrations enable row level security;
alter table pin_attempts       enable row level security;
alter table jobs               enable row level security;

-- An owner reaches their own business, and everything hanging off it.
create policy owner_rw on businesses
  for all using (owner_user_id = auth.uid())
       with check (owner_user_id = auth.uid());

create policy owner_rw on programs
  for all using (exists (
        select 1 from businesses b
         where b.id = programs.business_id and b.owner_user_id = auth.uid()))
       with check (exists (
        select 1 from businesses b
         where b.id = programs.business_id and b.owner_user_id = auth.uid()));

create policy owner_rw on staff
  for all using (exists (
        select 1 from businesses b
         where b.id = staff.business_id and b.owner_user_id = auth.uid()))
       with check (exists (
        select 1 from businesses b
         where b.id = staff.business_id and b.owner_user_id = auth.uid()));

create policy owner_rw on members
  for all using (exists (
        select 1 from programs p join businesses b on b.id = p.business_id
         where p.id = members.program_id and b.owner_user_id = auth.uid()))
       with check (exists (
        select 1 from programs p join businesses b on b.id = p.business_id
         where p.id = members.program_id and b.owner_user_id = auth.uid()));

create policy owner_rw on broadcasts
  for all using (exists (
        select 1 from programs p join businesses b on b.id = p.business_id
         where p.id = broadcasts.program_id and b.owner_user_id = auth.uid()))
       with check (exists (
        select 1 from programs p join businesses b on b.id = p.business_id
         where p.id = broadcasts.program_id and b.owner_user_id = auth.uid()));

create policy owner_r on stamp_events
  for select using (exists (
        select 1 from members m
          join programs p   on p.id = m.program_id
          join businesses b on b.id = p.business_id
         where m.id = stamp_events.member_id and b.owner_user_id = auth.uid()));

-- Nobody reaches these through the public API. Service role only: the device
-- registration table and the queue are infrastructure, not owner data.
