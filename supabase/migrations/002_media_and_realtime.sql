begin;
-- Private compressed JPEGs. No media bytes are stored in the database.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sharehub-media','sharehub-media',false,1048576,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/jpeg'];
create policy sharehub_media_read on storage.objects for select to authenticated
using(bucket_id='sharehub-media' and (select sharehub_private.member_role()) is not null);
create policy sharehub_media_upload on storage.objects for insert to authenticated
with check(bucket_id='sharehub-media' and (select sharehub_private.member_role()) is not null and split_part(name,'/',1)=(select auth.uid())::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
-- No browser delete/update policy: old signed references cannot be broken by a different user.
-- Remove unused files using the Supabase dashboard after checking references.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['posts','shares','groups','app_settings','profiles','profile_contacts'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
commit;
