import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/001_sharehub.sql',import.meta.url),'utf8'));
const ids={owner:'11111111-1111-4111-8111-111111111111',admin:'22222222-2222-4222-8222-222222222222',mod:'33333333-3333-4333-8333-333333333333',other:'44444444-4444-4444-8444-444444444444',outsider:'55555555-5555-4555-8555-555555555555'};
for(const [name,id] of Object.entries(ids)) {
 await db.query('insert into auth.users(id,email) values($1,$2)',[id,name+'@example.com']);
 if(name!=='outsider'){await db.query('insert into public.profiles(id,name,username,role) values($1,$2,$2,$3)',[id,name,name==='owner'?'superadmin':name==='admin'?'admin':'moderator']);await db.query('insert into public.profile_contacts(id,email,phone) values($1,$2,$3)',[id,name+'@example.com','01700000000']);}
}
async function as(name,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]]);try{return await fn();}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}}
const apply=changes=>db.query('select public.sharehub_apply($1::jsonb)',[JSON.stringify(changes)]);
const change=(table,id,version,values={},operation='upsert')=>({table,id,version,values,operation});
test('schema compiles; anonymous cannot read team data or call snapshot',async()=>{
 await db.exec('set role anon');try{await assert.rejects(()=>db.query('select * from public.posts'),/permission denied/);await assert.rejects(()=>db.query('select public.sharehub_snapshot()'),/permission denied/);}finally{await db.exec('reset role');}
});
test('outsider cannot read rows or use RPC',async()=>as('outsider',async()=>{assert.equal((await db.query('select * from public.profiles')).rows.length,0);await assert.rejects(()=>db.query('select public.sharehub_snapshot()'),/active membership/);}));
test('moderator can see team directory but only own contacts; no audit log',async()=>as('mod',async()=>{
 assert.equal((await db.query('select * from public.profiles')).rows.length,4);
 assert.deepEqual((await db.query('select id from public.profile_contacts')).rows.map(x=>x.id),[ids.mod]);
 const snap=(await db.query('select public.sharehub_snapshot() s')).rows[0].s;assert.equal(snap.profile_contacts.length,1);assert.equal(snap.audit_log.length,0);
}));
test('admin creates a post; moderator cannot bypass RPC writes',async()=>{
 await as('owner',()=>apply([change('posts','test_post',0,{title:'Admission',date:'2020-01-01',time:'09:00',fb_link:'https://www.facebook.com/ubei/posts/AbC123'})]));
 await as('mod',async()=>{await assert.rejects(()=>db.query("update public.profiles set role='superadmin' where id=$1",[ids.mod]),/permission denied/);await assert.rejects(()=>apply([change('posts','bad_post',0,{title:'Bad',date:'2020-01-01'})]),/Only admins/);});
});
test('submission identity, assignment, review permission, unique task and link',async()=>{
 await as('mod',()=>apply([change('shares','share1',0,{post_id:'test_post',user_id:ids.mod,group_id:null,link:'https://www.facebook.com/share/p/CaseA'})]));
 await as('mod',()=>assert.rejects(()=>apply([change('shares','share1',1,{status:'verified'})]),/Unexpected or protected/));
 await as('other',()=>assert.rejects(()=>apply([change('shares','attack',0,{post_id:'test_post',user_id:ids.mod,link:'https://www.facebook.com/share/p/other'})]),/own shares/));
 await as('mod',()=>assert.rejects(()=>apply([change('shares','dup',0,{post_id:'test_post',user_id:ids.mod,link:'https://www.facebook.com/share/p/CaseB'})]),/duplicate key/));
 await as('other',()=>assert.rejects(()=>apply([change('shares','dup2',0,{post_id:'test_post',user_id:ids.other,link:'https://www.facebook.com/share/p/CaseA'})]),/duplicate key/));
 await as('admin',()=>apply([change('shares','share1',1,{status:'verified'})]));
 const row=(await db.query("select * from public.shares where id='share1'")).rows[0];assert.equal(row.status,'verified');assert.equal(row.checked_by,ids.admin);
 await as('mod',()=>assert.rejects(()=>apply([change('shares','share1',2,{},'delete')]),/pending shares/));
});
test('editing a verified share resets review and preserves first submission timestamp',async()=>{
 const before=(await db.query("select first_at from public.shares where id='share1'")).rows[0].first_at;
 await as('mod',()=>apply([change('shares','share1',2,{link:'https://www.facebook.com/share/p/NewLink'})]));
 const row=(await db.query("select * from public.shares where id='share1'")).rows[0];assert.equal(row.status,'pending');assert.equal(row.checked_by,null);assert.equal(+new Date(row.first_at),+new Date(before));
});
test('stale versions reject atomically without losing a different record',async()=>as('admin',async()=>{
 await assert.rejects(()=>apply([change('groups','atomic_group',0,{name:'Rollback',url:'https://www.facebook.com/groups/rollback'}),change('posts','test_post',99,{title:'Wrong'})]),/changed on another device/);
 assert.equal((await db.query("select * from public.groups where id='atomic_group'")).rows.length,0);
}));
test('role escalation, protected contact fields and unassigned submissions are rejected',async()=>{
 await as('mod',()=>assert.rejects(()=>apply([change('profiles',ids.mod,1,{role:'superadmin'})]),/Unexpected or protected/));
 await as('mod',()=>assert.rejects(()=>apply([change('profile_contacts',ids.mod,1,{email:'takeover@example.com'})]),/Unexpected or protected/));
 await as('owner',()=>apply([change('posts','no_task',0,{title:'No tasks',date:'2020-01-01',assignment:'none',fb_link:'https://www.facebook.com/ubei/posts/NoTask'})]));
 await as('mod',()=>assert.rejects(()=>apply([change('shares','unassigned',0,{post_id:'no_task',user_id:ids.mod,link:'https://www.facebook.com/share/p/Unassigned'})]),/not assigned/));
});
test('future posts and fake Facebook hosts cannot receive submissions',async()=>{
 await as('owner',()=>apply([change('posts','future',0,{title:'Future',date:'2099-01-01',fb_link:'https://www.facebook.com/ubei/posts/Future'})]));
 await as('mod',()=>assert.rejects(()=>apply([change('shares','early',0,{post_id:'future',user_id:ids.mod,link:'https://www.facebook.com/share/p/Early'})]),/not live/));
 await as('owner',()=>assert.rejects(()=>apply([change('posts','xss',0,{title:'XSS',date:'2020-01-01',fb_link:'https://www.facebook.com.evil.test/posts/id'})]),/Invalid post/));
});
test('deactivation revokes access even when an old JWT remains valid',async()=>{
 await as('admin',()=>apply([change('profiles',ids.other,1,{active:false})]));
 await as('other',()=>assert.rejects(()=>db.query('select public.sharehub_snapshot()'),/active membership/));
});
test('service-only member management cannot be called by a signed-in moderator',async()=>as('mod',()=>assert.rejects(()=>db.query('select public.sharehub_admin_member($1,$1,$2::jsonb)',[ids.mod,JSON.stringify({role:'superadmin'})]),/permission denied/)));
test('server canonicalization prevents mobile/tracking aliases bypassing duplicate checks',async()=>{
 await as('owner',()=>assert.rejects(()=>apply([change('posts','alias',0,{title:'Alias',date:'2020-01-01',fb_link:'http://m.facebook.com/ubei/posts/AbC123/?utm_source=test'})]),/duplicate key/));
});
test('ordinary admins cannot promote moderators or edit a Super Admin through the service RPC',async()=>{
 await assert.rejects(()=>db.query('select public.sharehub_admin_member($1,$2,$3::jsonb)',[ids.admin,ids.mod,JSON.stringify({role:'superadmin'})]),/Super Admin required/);
 await assert.rejects(()=>db.query('select public.sharehub_admin_member($1,$2,$3::jsonb)',[ids.admin,ids.owner,JSON.stringify({active:false})]),/Super Admin required/);
 await assert.rejects(()=>db.query('select public.sharehub_admin_member($1,$1,$2::jsonb)',[ids.owner,JSON.stringify({active:false})]),/own role or active/);
});
test('member edits have optimistic concurrency and safe media validation',async()=>{
 await assert.rejects(()=>db.query('select public.sharehub_admin_member($1,$2,$3::jsonb,$4::jsonb,999)',[ids.owner,ids.mod,JSON.stringify({name:'Stale'}),'{}']),/changed on another device/);
 await assert.rejects(()=>db.query('select public.sharehub_admin_member($1,$2,$3::jsonb)',[ids.owner,ids.mod,JSON.stringify({photo:'javascript:alert(1)'})]),/Invalid member media/);
});
test('private Storage policy allows active members to upload only into their own folder',async()=>{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(await fs.readFile(new URL('../supabase/migrations/002_media_and_realtime.sql',import.meta.url),'utf8'));
 await as('mod',async()=>{
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['sharehub-media',ids.mod+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg']);
  await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['sharehub-media',ids.owner+'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg']),/row-level security/);
  assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await db.query("delete from storage.objects where bucket_id='sharehub-media'");assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 });
 await as('other',()=>assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['sharehub-media',ids.other+'/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg']),/row-level security/));
});
test('offline restore SQL is reviewable, refuses a nonempty database, and restores business data',async()=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'ubei-restore-test-'));
 try{
  const snapshot=await as('owner',async()=>(await db.query('select public.sharehub_snapshot() s')).rows[0].s);
  const input=join(dir,'backup.json'),output=join(dir,'restore.sql');
  await writeFile(input,JSON.stringify({format:'ubei-sharehub-v3',snapshot}));
  const command=spawnSync(process.execPath,[new URL('../scripts/restore-sql.mjs',import.meta.url).pathname,input,output],{encoding:'utf8'});assert.equal(command.status,0,command.stderr);
  const sql=await readFile(output,'utf8');assert.ok(!sql.includes('delete from public'));
  await assert.rejects(()=>db.exec(sql),/requires empty posts/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from public.posts')).rows[0].n,snapshot.posts.length);
  await db.exec('truncate public.shares,public.posts,public.groups cascade');await db.exec(sql);
  assert.equal((await db.query('select count(*)::int n from public.posts')).rows[0].n,snapshot.posts.length);
  assert.equal((await db.query('select count(*)::int n from public.shares')).rows[0].n,snapshot.shares.length);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('omitted or null RPC operation cannot bypass protected-field validation',async()=>as('mod',async()=>{
 for(const operation of [undefined,null])await assert.rejects(()=>apply([{table:'profiles',id:ids.mod,version:1,values:{role:'superadmin'},...(operation===undefined?{}:{operation})}]),/Unexpected or protected/);
 assert.equal((await db.query('select role from public.profiles where id=$1',[ids.mod])).rows[0].role,'moderator');
}));
