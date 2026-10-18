-- Run AFTER 001 and 002. First create this user in Authentication > Users > Add user.
-- Replace only the email and username below. Password is set in Auth, never in this file.
begin;
do $$
declare first_email text := 'REPLACE_WITH_YOUR_EMAIL'; first_username text := 'sumon'; first_id uuid;
begin
 perform pg_advisory_xact_lock(73190517);
 if exists(select 1 from public.profiles where role='superadmin' and active) then raise exception 'A Super Admin already exists. Use the app to manage accounts.'; end if;
 select id into first_id from auth.users where lower(email)=lower(first_email);
 if first_id is null then raise exception 'Create this exact email in Authentication > Users first'; end if;
 insert into public.profiles(id,name,username,role,color) values(first_id,'UBEI Super Admin',first_username,'superadmin','#6366F1');
 insert into public.profile_contacts(id,email) values(first_id,first_email);
end $$;
commit;
