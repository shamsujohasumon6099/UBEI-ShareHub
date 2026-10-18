import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');let checked=0;
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){
 const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);
 else if(/\.(m?js|ts)$/.test(file)){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||'Syntax check failed: '+file);checked++;
 }
}}
for(const dir of ['src','scripts','tests','supabase/functions'])await walk(path.join(root,dir));
const headers=await fs.readFile(path.join(root,'public/_headers'),'utf8'),vercel=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
const csp=vercel.headers[0].headers.find(x=>x.key==='Content-Security-Policy').value;
if(!headers.includes('Content-Security-Policy: '+csp))throw new Error('Hosting CSP configurations must match');
if(!csp.includes("script-src 'self'"))throw new Error('Inline scripts must remain disabled in production');
const config=await fs.readFile(path.join(root,'src/lib/config.js'),'utf8');if(/SERVICE_ROLE_KEY/.test(config))throw new Error('Server secrets do not belong in frontend configuration');
console.log(`Syntax checked ${checked} JavaScript/TypeScript files; hosting headers and client configuration verified.`);
