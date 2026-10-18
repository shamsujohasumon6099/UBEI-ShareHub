/** Real UI + Supabase SDK + real PostgreSQL RPCs. Auth HTTP is a local test double.
 * This verifies integration contracts, not a hosted Supabase Auth/Storage deployment. */
import {createServer} from 'node:http';import {spawn} from 'node:child_process';import fs from 'node:fs/promises';
import {todayYmd} from '../src/lib/domain.js';
import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {chromium} from 'playwright';
const db=new PGlite(),apiOrigin='http://127.0.0.1:5194',appOrigin='http://127.0.0.1:5184';
const owner='11111111-1111-4111-8111-111111111111',mod='33333333-3333-4333-8333-333333333333';
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/001_sharehub.sql',import.meta.url),'utf8'));
for(const [id,email,name,role] of [[owner,'owner@ubei.test','owner','superadmin'],[mod,'moderator@ubei.test','moderator','moderator']]){
 await db.query('insert into auth.users values($1,$2)',[id,email]);await db.query('insert into public.profiles(id,name,username,role) values($1,$2,$2,$3)',[id,name,role]);await db.query('insert into public.profile_contacts(id,email) values($1,$2)',[id,email]);
}
const accounts=new Map([['owner@ubei.test',{id:owner,email:'owner@ubei.test',role:'authenticated',aud:'authenticated',created_at:new Date().toISOString()}],['moderator@ubei.test',{id:mod,email:'moderator@ubei.test',role:'authenticated',aud:'authenticated',created_at:new Date().toISOString()}]]);
const tokens=new Map();let queue=Promise.resolve(),failWrites=false;
const api=createServer((req,res)=>{queue=queue.then(async()=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end('{}');return;}
 let body='';for await(const chunk of req)body+=chunk;const data=body?JSON.parse(body):{},path=new URL(req.url,apiOrigin).pathname;
 const answer=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
 if(path==='/auth/v1/token'){
  const user=accounts.get(data.email);if(!user||data.password!=='StrongPass123!'){answer(400,{error:'invalid_grant',error_description:'Invalid login credentials'});return;}
  const exp=Math.floor(Date.now()/1000)+3600,token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp,role:'authenticated',aud:'authenticated'})).toString('base64url')+'.test';tokens.set(token,user);
  answer(200,{access_token:token,refresh_token:'test-refresh-'+user.id,token_type:'bearer',expires_in:3600,expires_at:exp,user});return;
 }
 const user=tokens.get(req.headers.authorization?.replace(/^Bearer /i,''));
 if(path==='/auth/v1/logout'){answer(200,{});return;}
 if(path==='/auth/v1/user'){answer(user?200:401,user||{message:'Invalid JWT'});return;}
 if(path.startsWith('/functions/')){answer(503,{error:'Local test: Edge Function not deployed'});return;}
 const fn=path.split('/').at(-1);
 if(!user||!['sharehub_snapshot','sharehub_revision','sharehub_apply','sharehub_touch_login'].includes(fn)){answer(401,{message:'Not authorized'});return;}
 if(fn==='sharehub_apply'&&failWrites){answer(503,{message:'Test server unavailable'});return;}
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user.id]);
 try{const result=await db.query('select public.'+fn+(fn==='sharehub_apply'?'($1::jsonb) result':'() result'),fn==='sharehub_apply'?[JSON.stringify(data.changes)]:[]);answer(200,result.rows[0].result);}
 catch(error){answer(400,{message:error.message,code:error.code});}
 finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}
}).catch(error=>{if(!res.writableEnded){res.statusCode=500;res.end(JSON.stringify({message:error.message}));}});});
await new Promise(r=>api.listen(5194,'127.0.0.1',r));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5184'],{cwd:import.meta.dirname+'/..',env:{...process.env,VITE_SUPABASE_URL:apiOrigin,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_test',VITE_ENABLE_DEMO:'false'},stdio:'pipe'});
let log='';server.stdout.on('data',s=>log+=s);server.stderr.on('data',s=>log+=s);
let browser,checks=0;const check=(name,value)=>{assert.ok(value,name);checks++;console.log('PASS',name);};const errors=[];
async function login(p,role,email){await p.goto(appOrigin+'/'+role+'.html');await p.locator('[name=username]').fill(email);await p.locator('[name=password]').fill('StrongPass123!');await p.locator('[data-form=login] [type=submit]').click();await p.locator('.sidebar').waitFor();}
try{
 for(let i=0;i<100;i++){try{if((await fetch(appOrigin+'/admin.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],headless:true});
 const adminContext=await browser.newContext(),modContext=await browser.newContext();
 const a=await adminContext.newPage(),m=await modContext.newPage();for(const p of [a,m])p.on('pageerror',e=>errors.push(e.message));
 await login(a,'admin','owner@ubei.test');check('cloud email login and real membership',await a.locator('body').getAttribute('data-mode')==='cloud');
 check('cloud has no demo accounts',await a.locator('[data-action=fill-demo]').count()===0);
 await a.locator('[data-action=new-post]').first().click();await a.locator('#pf [name=title]').fill('Cloud QA Post');await a.locator('#pf [name=date]').fill(todayYmd());await a.locator('#pf [name=time]').fill('00:00');await a.locator('#pf [name=fbLink]').fill('https://www.facebook.com/ubei/posts/CloudQA');await a.locator('[form=pf][type=submit]').click();
 await a.waitForFunction(()=>!document.body.classList.contains('is-saving'));await a.locator('.toast').filter({hasText:'Post created'}).waitFor();
 check('post persisted through SDK and transactional RPC',(await db.query("select title from public.posts")).rows.some(x=>x.title==='Cloud QA Post'));
 await login(m,'moderator','moderator@ubei.test');check('separate device reads cloud data',(await m.locator('#content').textContent()).includes('Cloud QA Post'));
 await m.locator('[data-action=open-task]').first().click();const f=m.locator('[data-form=submit-share]').first();await f.locator('[name=link]').fill('https://m.facebook.com/share/p/CloudSubmission/?utm_source=qa');await f.locator('[type=submit]').click();await m.waitForFunction(()=>!document.body.classList.contains('is-saving'));await m.locator('.toast').filter({hasText:'submitted'}).waitFor();
 let row=(await db.query('select * from public.shares')).rows[0];check('moderator submission saved as pending with canonical URL',row.status==='pending'&&row.user_id===mod&&row.link==='https://www.facebook.com/share/p/CloudSubmission');
 await a.locator('[data-action=sync]').click();await a.locator('.sidebar [data-page=verify]').click();await a.locator('[data-action=verify][data-s=verified]').first().click();await a.waitForFunction(()=>!document.body.classList.contains('is-saving'));
 row=(await db.query('select * from public.shares')).rows[0];check('admin review persisted with authenticated reviewer',row.status==='verified'&&row.checked_by===owner);
 await m.keyboard.press('Escape');await m.locator('.sidebar [data-page=profile]').click();await m.locator('[name=phone]').fill('01712345678');await m.locator('[data-form=profile] [type=submit]').click();await m.waitForFunction(()=>!document.body.classList.contains('is-saving'));
 check('private contact save works',(await db.query('select phone from public.profile_contacts where id=$1',[mod])).rows[0].phone==='01712345678');
 await m.locator('.sidebar [data-page=calendar]').click();await m.locator('[data-action=open-post]').first().click();
 const again=m.locator('[data-form=submit-share]').first();await again.locator('[name=link]').fill('https://www.facebook.com/share/p/CloudResubmit');await again.locator('[type=submit]').click();await m.waitForFunction(()=>!document.body.classList.contains('is-saving'));
 await a.locator('[data-action=sync]').click();await a.locator('.sidebar [data-page=verify]').click();await a.locator('[data-action=review-start]').first().click();await a.locator('[data-action=review-do][data-s=verified]').click();await a.waitForFunction(()=>!document.body.classList.contains('is-saving'));
 check('quick review persists to PostgreSQL',(await db.query('select status from public.shares')).rows[0].status==='verified');await a.keyboard.press('Escape');
 check('production database is not saved in localStorage',await a.evaluate(()=>!localStorage.getItem('ubei_sharehub_demo_v3')));
 failWrites=true;await a.locator('[data-action=new-post]').first().click();await a.locator('#pf [name=title]').fill('Must not persist');await a.locator('#pf [name=date]').fill('2020-01-02');await a.locator('[form=pf][type=submit]').click();await a.waitForFunction(()=>!document.body.classList.contains('is-saving'));await a.locator('.toast.error').filter({hasText:'Test server unavailable'}).waitFor();
 check('failed write is reported and rolled back',!(await db.query('select title from public.posts')).rows.some(x=>x.title==='Must not persist'));
 check('cloud browser has no JavaScript errors',errors.length===0);console.log('PASS',checks,'cloud integration checks (local Auth double)');
 await fs.mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../test-results/cloud-results.json',import.meta.url),JSON.stringify({checks,errors,scope:'SDK + real PostgreSQL RPCs; local Auth double; hosted services untested'},null,2));
}finally{await browser?.close();server.kill('SIGTERM');api.closeAllConnections();await new Promise(r=>api.close(r));await db.close();}
