-- UBEI ShareHub v3. Apply once to a NEW Supabase project. PostgreSQL 15+.
-- Auth identities and passwords belong to Supabase Auth; no password column exists here.
begin;
create schema if not exists sharehub_private;
revoke all on schema sharehub_private from public, anon, authenticated;
grant usage on schema sharehub_private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  username text not null check (username ~ '^[A-Za-z0-9_.]{3,30}$'),
  role text not null check (role in ('superadmin','admin','moderator')),
  active boolean not null default true,
  fb text not null default '', photo text not null default '',
  color text not null default '#6366F1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create unique index profiles_username_ci on public.profiles(lower(username));
-- Contacts and read markers are private, separate from the team directory.
create table public.profile_contacts (
  id uuid primary key references public.profiles(id) on delete cascade,
  email text not null default '', phone text not null default '',
  last_login timestamptz, notif_seen timestamptz, notice_seen text,
  version integer not null default 1
);
create unique index contacts_email_ci on public.profile_contacts(lower(email)) where email <> '';
create table public.groups (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  name text not null check (length(trim(name)) between 1 and 100),
  url text not null, note text not null default '' check (length(note) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(), version integer not null default 1
);
create unique index groups_url_unique on public.groups(url);
create table public.posts (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  title text not null check (length(trim(title)) between 1 and 200),
  caption text not null default '' check (length(caption) <= 20000),
  tag text not null default 'Other' check (tag in ('Promo','Update','Event','Offer','Other')),
  date date not null, time time not null default '00:00',
  image text not null default '', fb_link text not null default '',
  assignment text not null default 'all' check (assignment in ('all','selected','none')),
  assignees uuid[] not null default '{}', group_share boolean not null default false,
  group_tasks jsonb not null default '[]' check (jsonb_typeof(group_tasks) = 'array'),
  created_at timestamptz not null default now(), created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz, updated_by uuid references public.profiles(id) on delete set null,
  version integer not null default 1
);
create unique index posts_fb_link_unique on public.posts(fb_link) where fb_link <> '';
create index posts_date_idx on public.posts(date);
create table public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  post_id text not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id text references public.groups(id) on delete cascade,
  link text not null unique,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  note text not null default '' check (length(note) <= 2000),
  submitted_at timestamptz not null default now(), first_at timestamptz not null default now(), edited_at timestamptz,
  checked_at timestamptz, checked_by uuid references public.profiles(id) on delete set null,
  version integer not null default 1,
  unique nulls not distinct (post_id,user_id,group_id)
);
create index shares_user_idx on public.shares(user_id);
create index shares_post_idx on public.shares(post_id);
create index shares_pending_idx on public.shares(submitted_at) where status='pending';
create table public.app_settings (
  id text primary key default 'main' check (id='main'),
  page_name text not null default 'Uttar Bango Engineering Institute' check (length(page_name) between 1 and 150),
  page_url text not null default 'https://www.facebook.com/ubei.edu.bd',
  deadline_hours integer not null default 24 check (deadline_hours in (0,2,4,6,12,24,48)),
  notice jsonb, hide_setup boolean not null default false, last_backup timestamptz,
  version integer not null default 1
);
insert into public.app_settings(id) values ('main');
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), by uuid references public.profiles(id) on delete set null,
  type text not null, text text not null, vars jsonb not null default '{}'
);
create index audit_log_at_idx on public.audit_log(at desc);

create function sharehub_private.member_role() returns text language sql stable security definer
set search_path='' as $$ select role from public.profiles where id=(select auth.uid()) and active $$;
create function sharehub_private.is_admin() returns boolean language sql stable security definer
set search_path='' as $$ select coalesce(sharehub_private.member_role() in ('admin','superadmin'),false) $$;
create function sharehub_private.fb_url(s text) returns boolean language sql immutable
set search_path='' as $$ select coalesce(length(s)<=2048 and s ~ '^https://([a-zA-Z0-9-]+\.)*(facebook\.com|fb\.com|fb\.watch|fb\.me)/[^[:space:]<>"\\]*$',false) $$;
create function sharehub_private.canonical_link(s text) returns text language plpgsql immutable set search_path='' as $$
declare base text; host text; query text; result text;
begin
 s:=trim(coalesce(s,'')); if s='' then return ''; end if;
 s:=regexp_replace(s,'^http://','https://','i'); s:=split_part(s,'#',1);
 host:=lower(split_part(split_part(s,'://',2),'/',1));
 if host ~ '^(m\.|web\.|mbasic\.|mobile\.|touch\.|business\.|free\.)?facebook\.com$' then s:=regexp_replace(s,'^https://[^/]+','https://www.facebook.com');
 else s:=regexp_replace(s,'^https://[^/]+','https://'||host); end if;
 base:=rtrim(split_part(s,'?',1),'/');
 query:=case when position('?' in s)>0 then substring(s from position('?' in s)+1) else '' end;
 select string_agg(x,'&' order by x) into result from unnest(string_to_array(query,'&')) x
 where x<>'' and split_part(x,'=',1) !~* '^(mibextid|rdid|share_url|__cft__.*|__tn__|ref|refsrc|_rdr|_rdc|paipv|eav|sfnsn|extid|notif_id|notif_t|comment_tracking|locale|hoisted_section_header_type|acontext|app|s|fs|sk|wtsid|mibext|utm_.*|fbclid|context|source|entry_point)$';
 return base||case when result is null then '' else '?'||result end;
end $$;
create function sharehub_private.post_url(s text) returns boolean language sql immutable
set search_path='' as $$ select sharehub_private.fb_url(s) and (
 s ~ '^https://(fb\.watch|fb\.me)/[^/?#]+' or
 s ~ '/(posts|permalink|videos|photos|reel)/[^/?#]+' or
 s ~ '/share/[^/?#]+/[^/?#]+' or s ~ '[?&](story_fbid|fbid|v)=[^&]+'
) $$;
create function sharehub_private.media_url(s text) returns boolean language sql immutable
set search_path='' as $$ select s='' or length(s)<=2048 and (s ~ '^https://[^[:space:]<>"\\]+$' or s ~ '^storage:[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') $$;

-- Explicit table grants + RLS: users cannot bypass the transactional RPC with REST writes.
do $$ declare t text; begin
 foreach t in array array['profiles','profile_contacts','posts','shares','groups','app_settings','audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy team_directory on public.profiles for select to authenticated using ((select sharehub_private.member_role()) is not null);
create policy private_contacts on public.profile_contacts for select to authenticated using ((select sharehub_private.member_role()) is not null and (id=(select auth.uid()) or (select sharehub_private.is_admin())));
create policy team_posts on public.posts for select to authenticated using ((select sharehub_private.member_role()) is not null);
create policy team_shares on public.shares for select to authenticated using ((select sharehub_private.member_role()) is not null);
create policy team_groups on public.groups for select to authenticated using ((select sharehub_private.member_role()) is not null);
create policy team_settings on public.app_settings for select to authenticated using ((select sharehub_private.member_role()) is not null);
create policy admin_audit on public.audit_log for select to authenticated using ((select sharehub_private.is_admin()));

-- Small polling token: unchanged teams avoid downloading their full history each minute.
create function public.sharehub_revision() returns text language plpgsql stable security definer set search_path='' as $$
declare r text:=sharehub_private.member_role(); result text;
begin
 if r is null then raise exception 'Active membership required' using errcode='42501'; end if;
 select concat((select coalesce(max(id),0) from public.audit_log),'/',(select coalesce(sum(version),0) from public.profiles),'/',(select coalesce(sum(version),0) from public.profile_contacts where id=auth.uid() or r in ('admin','superadmin'))) into result;
 return result;
end $$;
-- A coherent snapshot, including ONLY the contacts the caller can see.
create function public.sharehub_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid(); r text := sharehub_private.member_role(); result jsonb;
begin
 if r is null then raise exception 'Access denied: active membership required' using errcode='42501'; end if;
 select jsonb_build_object(
  'revision',public.sharehub_revision(),
  'profiles',coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t),'[]'),
  'profile_contacts',coalesce((select jsonb_agg(to_jsonb(t)) from public.profile_contacts t where t.id=me or r in ('admin','superadmin')),'[]'),
  'posts',coalesce((select jsonb_agg(to_jsonb(t)) from public.posts t),'[]'),
  'shares',coalesce((select jsonb_agg(to_jsonb(t)) from public.shares t),'[]'),
  'groups',coalesce((select jsonb_agg(to_jsonb(t)) from public.groups t),'[]'),
  'app_settings',coalesce((select jsonb_agg(to_jsonb(t)) from public.app_settings t),'[]'),
  'audit_log',case when r in ('admin','superadmin') then coalesce((select jsonb_agg(to_jsonb(t)) from (select * from public.audit_log order by at desc,id desc limit 600) t),'[]') else '[]'::jsonb end
 ) into result;
 return result;
end $$;

-- An entire user action is atomic. Version checks prevent silently overwriting another person's work.
create function public.sharehub_apply(changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid(); r text; c jsonb; tbl text; key text; old jsonb; val jsonb; row_data jsonb;
 allowed text[]; columns_sql text; expected integer; deleting boolean; p public.posts; target public.profiles; g jsonb; uid_value text; changed_link boolean;
begin
 -- Serialize identity/role changes with admin_save_member to prevent privilege races.
 perform pg_advisory_xact_lock(73190517);
 select role into r from public.profiles where id=me and active for share;
 if r is null then raise exception 'Access denied: active membership required' using errcode='42501'; end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>500 or octet_length(changes::text)>2097152 then raise exception 'Invalid or oversized change set'; end if;
 if (select count(*) from jsonb_array_elements(changes))<>(select count(distinct (x->>'table')||':'||(x->>'id')) from jsonb_array_elements(changes) x) then raise exception 'Duplicate change'; end if;
 for c in select * from jsonb_array_elements(changes) loop
  tbl:=c->>'table'; key:=c->>'id'; val:=coalesce(c->'values','{}'); expected:=coalesce((c->>'version')::integer,0); deleting:=coalesce(c->>'operation'='delete',false);
  if coalesce(c->>'operation','upsert') not in ('upsert','delete') then raise exception 'Invalid operation'; end if;
  if tbl not in ('posts','shares','groups','app_settings','profiles','profile_contacts') or key is null or length(key)>80 or jsonb_typeof(val)<>'object' then raise exception 'Invalid change'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id::text=$1 for update',tbl) into old using key;
  if (old is null and expected<>0) or (old is not null and expected<>(old->>'version')::integer) then raise exception 'Record changed on another device. Refresh and try again.' using errcode='40001'; end if;
  if deleting and old is null then raise exception 'Record no longer exists' using errcode='40001'; end if;
  case tbl
  when 'posts' then
   if r not in ('admin','superadmin') then raise exception 'Only admins can manage posts' using errcode='42501'; end if;
   allowed:=array['title','caption','tag','date','time','image','fb_link','assignment','assignees','group_share','group_tasks'];
   row_data:=coalesce(old,jsonb_build_object('caption','','tag','Other','time','00:00','image','','fb_link','','assignment','all','assignees','[]'::jsonb,'group_share',false,'group_tasks','[]'::jsonb,'created_at',now(),'created_by',me))||val;
   if not deleting then
    row_data:=jsonb_set(row_data,'{fb_link}',to_jsonb(sharehub_private.canonical_link(row_data->>'fb_link')));
    if not sharehub_private.media_url(row_data->>'image') or ((row_data->>'fb_link')<>'' and not sharehub_private.post_url(row_data->>'fb_link')) then raise exception 'Invalid post media or Facebook post link'; end if;
    if jsonb_typeof(row_data->'assignees')<>'array' or jsonb_typeof(row_data->'group_tasks')<>'array' then raise exception 'Invalid assignment'; end if;
    if (select count(*) from jsonb_array_elements(row_data->'assignees'))<>(select count(distinct x) from jsonb_array_elements(row_data->'assignees') x) or (select count(*) from jsonb_array_elements(row_data->'group_tasks'))<>(select count(distinct x) from jsonb_array_elements(row_data->'group_tasks') x) then raise exception 'Duplicate assignment'; end if;
    if row_data->>'assignment'='selected' and jsonb_array_length(row_data->'assignees')=0 then raise exception 'Select at least one moderator'; end if;
    for uid_value in select jsonb_array_elements_text(row_data->'assignees') loop
     if not exists(select 1 from public.profiles where id::text=uid_value and role='moderator' and active) then raise exception 'Invalid moderator assignment'; end if;
    end loop;
    for g in select * from jsonb_array_elements(row_data->'group_tasks') loop
     if not exists(select 1 from public.profiles where id::text=g->>'userId' and role='moderator' and active) or not exists(select 1 from public.groups where id=g->>'groupId' and active) then raise exception 'Invalid group assignment'; end if;
    end loop;
    if (row_data->>'group_share')::boolean and jsonb_array_length(row_data->'group_tasks')=0 then raise exception 'Group sharing needs a task'; end if;
    row_data:=row_data||jsonb_build_object('updated_at',now(),'updated_by',me);
   end if;
  when 'groups' then
   if r not in ('admin','superadmin') then raise exception 'Only admins can manage groups' using errcode='42501'; end if;
   allowed:=array['name','url','note','active'];
   row_data:=coalesce(old,jsonb_build_object('note','','active',true,'created_at',now()))||val;
   row_data:=jsonb_set(row_data,'{url}',to_jsonb(sharehub_private.canonical_link(row_data->>'url')));
   if not deleting and (not sharehub_private.fb_url(row_data->>'url') or row_data->>'url' !~ '/groups/[^/?#]+') then raise exception 'Enter a Facebook group URL'; end if;
   if deleting then
    update public.posts set group_tasks=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(group_tasks) x where x->>'groupId'<>key),version=version+1,updated_at=now(),updated_by=me
    where exists(select 1 from jsonb_array_elements(group_tasks) x where x->>'groupId'=key);
   end if;
  when 'app_settings' then
   if r not in ('admin','superadmin') or deleting or key<>'main' then raise exception 'Settings change denied' using errcode='42501'; end if;
   allowed:=array['page_name','page_url','deadline_hours','notice','hide_setup','last_backup']; row_data:=old||val;
   row_data:=jsonb_set(row_data,'{page_url}',to_jsonb(sharehub_private.canonical_link(row_data->>'page_url')));
   if row_data->>'page_url'<>'' and not sharehub_private.fb_url(row_data->>'page_url') then raise exception 'Invalid Facebook page link'; end if;
   if val ? 'notice' and row_data->'notice'<>'null'::jsonb and row_data->'notice' is not null then
    if jsonb_typeof(row_data->'notice')<>'object' or jsonb_typeof(row_data->'notice'->'text') is distinct from 'string' or length(row_data->'notice'->>'text') not between 1 and 2000 then raise exception 'Notice must be 1 to 2000 characters'; end if;
    row_data:=jsonb_set(row_data,'{notice}',(row_data->'notice')||jsonb_build_object('at',now(),'by',me));
   end if;
  when 'profiles' then
   if deleting or old is null then raise exception 'Use the member management service' using errcode='42501'; end if;
   if key=me::text then
    allowed:=case when r='moderator' then array['fb','photo'] else array['name','fb','photo'] end;
   elsif r in ('admin','superadmin') and old->>'role'='moderator' then allowed:=array['active'];
   else raise exception 'Member change denied' using errcode='42501'; end if;
   row_data:=old||val;
   row_data:=jsonb_set(row_data,'{fb}',to_jsonb(sharehub_private.canonical_link(row_data->>'fb')));
   if not sharehub_private.media_url(row_data->>'photo') or (row_data->>'fb'<>'' and not sharehub_private.fb_url(row_data->>'fb')) then raise exception 'Invalid profile media or Facebook link'; end if;
  when 'profile_contacts' then
   if deleting or old is null or key<>me::text then raise exception 'Contact change denied' using errcode='42501'; end if;
   allowed:=array['phone','notif_seen','notice_seen']; row_data:=old||val;
   if length(coalesce(row_data->>'phone',''))>30 then raise exception 'Invalid phone'; end if;
  when 'shares' then
   if deleting then
    if r not in ('admin','superadmin') and (old->>'user_id'<>me::text or old->>'status'<>'pending') then raise exception 'Only your pending shares can be removed' using errcode='42501'; end if;
   end if;
   allowed:=case when r in ('admin','superadmin') then array['link','status','note'] else array['post_id','user_id','group_id','link'] end;
   row_data:=coalesce(old,jsonb_build_object('user_id',me,'group_id',null,'status','pending','note','','first_at',now(),'submitted_at',now()))||val;
   if not deleting then
    row_data:=jsonb_set(row_data,'{link}',to_jsonb(sharehub_private.canonical_link(row_data->>'link')));
    select * into p from public.posts where id=row_data->>'post_id';
    if p.id is null or not sharehub_private.post_url(row_data->>'link') or row_data->>'link'=p.fb_link then raise exception 'Enter the link of your shared Facebook post'; end if;
    if old is not null and (row_data->>'post_id' is distinct from old->>'post_id' or row_data->>'user_id' is distinct from old->>'user_id' or row_data->>'group_id' is distinct from old->>'group_id') then raise exception 'A share cannot be moved to another task'; end if;
    if row_data->>'group_id' is not null and row_data->>'link'=(select url from public.groups where id=row_data->>'group_id') then raise exception 'Use the group post link'; end if;
    if r='moderator' then
     if row_data->>'user_id'<>me::text then raise exception 'You can only submit your own shares' using errcode='42501'; end if;
     if p.fb_link='' or (p.date+p.time) at time zone 'Asia/Dhaka'>now() then raise exception 'This post is not live yet'; end if;
     if old is null and not (
      (row_data->>'group_id' is null and (p.assignment='all' or p.assignment='selected' and me=any(p.assignees))) or
      (row_data->>'group_id' is not null and p.group_share and exists(select 1 from jsonb_array_elements(p.group_tasks) x join public.groups gr on gr.id=x->>'groupId' and gr.active where x->>'userId'=me::text and x->>'groupId'=row_data->>'group_id'))
     ) then raise exception 'You are not assigned to this task' using errcode='42501'; end if;
     row_data:=row_data||jsonb_build_object('status','pending','note','','checked_at',null,'checked_by',null);
    elsif old is null then raise exception 'Admins cannot create submissions for another person' using errcode='42501';
    end if;
    changed_link:=old is null or row_data->>'link'<>old->>'link';
    if changed_link or (r='moderator' and old->>'status'='rejected') then row_data:=row_data||jsonb_build_object('submitted_at',now(),'edited_at',case when old is not null then now() else null end); end if;
    if r in ('admin','superadmin') and row_data->>'status' is distinct from old->>'status' then
     row_data:=row_data||jsonb_build_object('checked_at',case when row_data->>'status'<>'pending' then now() else null end,'checked_by',case when row_data->>'status'<>'pending' then me else null end);
    end if;
   end if;
  end case;
  if not deleting and exists(select 1 from jsonb_object_keys(val) k where not (k=any(allowed))) then raise exception 'Unexpected or protected field in %',tbl using errcode='42501'; end if;
  if deleting then
   if tbl in ('profiles','profile_contacts','app_settings') then raise exception 'Delete denied' using errcode='42501'; end if;
   execute format('delete from public.%I where id::text=$1',tbl) using key;
  else
   row_data:=row_data||jsonb_build_object('id',key,'version',expected+1);
   -- Column names come ONLY from the actual schema of a whitelisted table.
   select string_agg(format('%I',column_name),', ' order by ordinal_position) into columns_sql from information_schema.columns where table_schema='public' and table_name=tbl and column_name<>'id';
   execute format('insert into public.%1$I select (jsonb_populate_record(null::public.%1$I,$1)).* on conflict(id) do update set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I,$1))',tbl,columns_sql) using row_data;
  end if;
  insert into public.audit_log(by,type,text,vars) values(me,case tbl when 'posts' then 'post' when 'shares' then 'share' when 'groups' then 'group' when 'profiles' then 'user' else 'system' end,
   case when deleting then '{by} deleted {item}' else '{by} saved {item}' end,jsonb_build_object('item',coalesce(row_data->>'title',row_data->>'name',tbl)));
 end loop;
end $$;

-- Called only by the authenticated Edge Function using its server-only service role key.
create function public.sharehub_admin_member(actor_id uuid, member_id uuid, fields jsonb, contact jsonb default '{}', expected_version integer default null) returns void
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; prior public.profiles; desired public.profiles;
begin
 perform pg_advisory_xact_lock(73190517);
 select * into actor from public.profiles where id=actor_id and active;
 select * into prior from public.profiles where id=member_id for update;
 if prior.id is not null and expected_version is not null and prior.version<>expected_version then raise exception 'Record changed on another device. Refresh and try again.' using errcode='40001'; end if;
 if actor.id is null or actor.role not in ('admin','superadmin') then raise exception 'Admin required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(fields) k where not(k=any(array['name','username','role','active','fb','photo','color']))) or exists(select 1 from jsonb_object_keys(contact) k where not(k=any(array['email','phone']))) then raise exception 'Invalid member fields'; end if;
 desired:=jsonb_populate_record(null::public.profiles,coalesce(to_jsonb(prior),jsonb_build_object('id',member_id,'active',true,'fb','','photo','','color','#6366F1','created_at',now(),'version',0))||fields||jsonb_build_object('id',member_id));
 if actor.role<>'superadmin' and (desired.role<>'moderator' or prior.role in ('admin','superadmin')) then raise exception 'Super Admin required' using errcode='42501'; end if;
 if member_id=actor_id and (desired.role<>actor.role or not desired.active) then raise exception 'You cannot change your own role or active status'; end if;
 if prior.role='superadmin' and prior.active and (desired.role<>'superadmin' or not desired.active) and (select count(*) from public.profiles where role='superadmin' and active)<=1 then raise exception 'At least one active Super Admin is required'; end if;
 desired.fb:=sharehub_private.canonical_link(desired.fb);
 if not sharehub_private.media_url(desired.photo) or desired.fb<>'' and not sharehub_private.fb_url(desired.fb) then raise exception 'Invalid member media or Facebook link'; end if;
 insert into public.profiles(id,name,username,role,active,fb,photo,color) values(member_id,desired.name,desired.username,desired.role,desired.active,desired.fb,desired.photo,desired.color)
 on conflict(id) do update set name=excluded.name,username=excluded.username,role=excluded.role,active=excluded.active,fb=excluded.fb,photo=excluded.photo,color=excluded.color,version=profiles.version+1;
 insert into public.profile_contacts(id,email,phone) values(member_id,coalesce(contact->>'email',''),coalesce(contact->>'phone',''))
 on conflict(id) do update set email=coalesce(contact->>'email',profile_contacts.email),phone=coalesce(contact->>'phone',profile_contacts.phone),version=profile_contacts.version+1;
 insert into public.audit_log(by,type,text,vars) values(actor_id,'user','{by} updated account {name}',jsonb_build_object('name',desired.name));
end $$;
create function public.sharehub_touch_login() returns void language plpgsql security definer set search_path='' as $$
begin
 if sharehub_private.member_role() is null then raise exception 'Active membership required' using errcode='42501'; end if;
 update public.profile_contacts set last_login=now(),version=version+1 where id=auth.uid();
end $$;
-- Lock down every new RPC. SECURITY DEFINER never implies a public execution grant.
revoke all on all functions in schema sharehub_private from public,anon,authenticated;
grant execute on function sharehub_private.member_role(), sharehub_private.is_admin() to authenticated;
revoke all on function public.sharehub_revision(),public.sharehub_snapshot(), public.sharehub_apply(jsonb), public.sharehub_admin_member(uuid,uuid,jsonb,jsonb,integer),public.sharehub_touch_login() from public,anon,authenticated;
grant execute on function public.sharehub_revision(),public.sharehub_snapshot(),public.sharehub_apply(jsonb),public.sharehub_touch_login() to authenticated;
grant execute on function public.sharehub_admin_member(uuid,uuid,jsonb,jsonb,integer) to service_role;
commit;
