/** Offline, reviewable restore: generates SQL; never connects to a service. */
import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const [input,output,mappingFile]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node scripts/restore-sql.mjs backup.json restore.sql [user-id-map.json]');process.exit(1);}
const backup=JSON.parse(await fs.readFile(input,'utf8'));
if(backup.format!=='ubei-sharehub-v3'||!backup.snapshot)throw new Error('Use a cloud JSON export from UBEI ShareHub v3');
const map=mappingFile?JSON.parse(await fs.readFile(mappingFile,'utf8')):{};
for(const [from,to] of Object.entries(map))if(!/^[0-9a-f-]{36}$/i.test(from)||!/^[0-9a-f-]{36}$/i.test(to))throw new Error('The mapping must contain UUID -> UUID entries');
const remap=id=>map[id]||id;
const source=structuredClone(backup.snapshot);
for(const row of source.posts||[]){row.created_by=remap(row.created_by);row.updated_by=remap(row.updated_by);row.assignees=(row.assignees||[]).map(remap);row.group_tasks=(row.group_tasks||[]).map(t=>({...t,userId:remap(t.userId)}));}
for(const row of source.shares||[]){row.user_id=remap(row.user_id);row.checked_by=remap(row.checked_by);}
for(const row of source.app_settings||[])if(row.notice?.by)row.notice.by=remap(row.notice.by);
const data={groups:source.groups||[],posts:source.posts||[],shares:source.shares||[],app_settings:source.app_settings||[]};
const payload=JSON.stringify(data),delimiter='$sharehub_'+randomUUID().replaceAll('-','')+'$';
const sql=`-- Generated offline. REVIEW before running in Supabase SQL Editor.
-- Does not delete existing business data or recreate Auth users/passwords/media.
begin;
select pg_advisory_xact_lock(73190517);
do $$ begin
 if exists(select 1 from public.posts) or exists(select 1 from public.shares) or exists(select 1 from public.groups) then
  raise exception 'Restore requires empty posts, shares and groups. Use a NEW project or a reviewed manual recovery.';
 end if;
end $$;
create temporary table sharehub_restore_payload(data jsonb) on commit drop;
insert into sharehub_restore_payload values(${delimiter}${payload}${delimiter}::jsonb);
do $$ declare d jsonb; id_value uuid; begin
 select data into d from sharehub_restore_payload;
 for id_value in
  select distinct id from (
   select (x->>'user_id')::uuid id from jsonb_array_elements(d->'shares') x
   union select (x->>'checked_by')::uuid from jsonb_array_elements(d->'shares') x where x->>'checked_by' is not null
   union select (x->>'created_by')::uuid from jsonb_array_elements(d->'posts') x where x->>'created_by' is not null
   union select (x->>'updated_by')::uuid from jsonb_array_elements(d->'posts') x where x->>'updated_by' is not null
   union select a::uuid from jsonb_array_elements(d->'posts') x cross join lateral jsonb_array_elements_text(x->'assignees') a
   union select (t->>'userId')::uuid from jsonb_array_elements(d->'posts') x cross join lateral jsonb_array_elements(x->'group_tasks') t
  ) u
 loop
  if not exists(select 1 from public.profiles where id=id_value) then raise exception 'Missing member %. Recreate accounts and provide an old-to-new UUID map.',id_value; end if;
 end loop;
end $$;
insert into public.groups select r.* from sharehub_restore_payload p cross join lateral jsonb_populate_recordset(null::public.groups,p.data->'groups') r;
insert into public.posts select r.* from sharehub_restore_payload p cross join lateral jsonb_populate_recordset(null::public.posts,p.data->'posts') r;
insert into public.shares select r.* from sharehub_restore_payload p cross join lateral jsonb_populate_recordset(null::public.shares,p.data->'shares') r;
update public.app_settings a set page_name=r.page_name,page_url=r.page_url,deadline_hours=r.deadline_hours,notice=r.notice,hide_setup=r.hide_setup,last_backup=r.last_backup,version=a.version+1
from sharehub_restore_payload p cross join lateral jsonb_populate_recordset(null::public.app_settings,p.data->'app_settings') r where a.id=r.id;
insert into public.audit_log(type,text) values('system','Business records restored from a UBEI ShareHub export');
commit;
`;
await fs.writeFile(output,sql,{flag:'wx'});
console.log(`Created ${output}. Review it before executing. Media and Auth accounts require separate recovery.`);
