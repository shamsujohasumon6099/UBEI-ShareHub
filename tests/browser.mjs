import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {todayYmd} from '../src/lib/domain.js';
const origin='http://127.0.0.1:5182',cwd=import.meta.dirname+'/..';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5182'],{cwd,stdio:'pipe'});
let serverLog='';for(const pipe of [server.stdout,server.stderr])pipe.on('data',s=>serverLog+=s);
const output=new URL('../test-results/',import.meta.url);await fs.mkdir(output,{recursive:true});
let browser,checks=0;const errors=[];
const check=(name,condition)=>{assert.ok(condition,name);checks++;console.log('PASS',name);};
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(origin+'/admin.html')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(serverLog);}
async function login(page,role,user){await page.goto(origin+'/'+role+'.html');await page.locator('[data-action="fill-demo"][data-u="'+user+'"]').click();await page.locator('[data-form=login] [type=submit]').click();await page.locator('.sidebar').waitFor();}
async function nav(page,id){await page.locator('.sidebar [data-action=nav][data-page="'+id+'"]').click({force:true});}
async function contrast(page){return page.evaluate(()=>{
 const parse=s=>s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
 const blend=(a,b)=>{const alpha=a[3]??1;return [0,1,2].map(i=>a[i]*alpha+b[i]*(1-alpha)).concat(1);};
 const lum=c=>{const x=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return x[0]*.2126+x[1]*.7152+x[2]*.0722;};
 const failures=[];
 for(const e of document.querySelectorAll('button,.btn,input:not([type=hidden]),select,textarea')){
  if(['checkbox','radio','file'].includes(e.type)||!e.getClientRects().length||e.disabled||!e.textContent.trim()&&e.tagName==='BUTTON')continue;
  let bg=[255,255,255,1],gradient=false;const ancestors=[];for(let n=e;n;n=n.parentElement)ancestors.unshift(n);
  for(const n of ancestors){const css=getComputedStyle(n);if(css.backgroundImage!=='none')gradient=true;bg=blend(parse(css.backgroundColor),bg);}
  if(gradient)continue;
  const css=getComputedStyle(e),fg=blend(parse(css.color),bg),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  if(ratio<4.45)failures.push({text:e.textContent.trim().slice(0,55)||e.name,color:css.color,bg,ratio:+ratio.toFixed(2)});
 }
 return failures;
});}
try{
 await ready();
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await login(page,'admin','admin');check('admin login + UBEI branding',(await page.title()).includes('UBEI ShareHub'));
 if(await page.locator('html').getAttribute('data-theme')!=='dark')await page.locator('[data-action=theme]').click();
 const hero=await page.locator('.th-side .btn').first().evaluate(e=>({color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));check('dark hero button has distinct text and background',hero.color!==hero.bg);
 const ids=await page.locator('.sidebar [data-page]').evaluateAll(es=>es.map(e=>e.dataset.page));
 const violations=[];
 for(const mode of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==mode)await page.locator('[data-action=theme]').click();
  for(const id of ids){await nav(page,id);check(mode+' admin '+id,await page.locator('#content').textContent());const bad=await contrast(page);if(bad.length)violations.push({mode,page:id,bad});}
 }
 console.log('CONTRAST',JSON.stringify(violations));check('admin control contrast',violations.length===0);
 await nav(page,'groups');await page.locator('[data-action=new-group]').first().click();
 await page.locator('#gf [name=name]').fill('QA Group');await page.locator('#gf [name=url]').fill('https://www.facebook.com/groups/qa_ubei');await page.locator('[type=submit][form=gf]').click();
 check('Facebook group CRUD create',(await page.locator('#content').textContent()).includes('QA Group'));
 await page.locator('[data-action=new-post]').first().click();await page.locator('#pf [name=title]').fill('UBEI QA Admission');
 await page.locator('#pf [name=date]').fill(todayYmd());await page.locator('#pf [name=time]').fill('00:00');await page.locator('#pf [name=fbLink]').fill('https://www.facebook.com/ubei/posts/QAAbC');
 await page.locator('[type=submit][form=pf]').click();
 await nav(page,'posts');await page.locator('#q').fill('UBEI QA Admission');check('post create + search',(await page.locator('#content').textContent()).includes('UBEI QA Admission'));
 await page.locator('[data-action=open-post]').first().click();check('modal dialog and background isolation',await page.locator('#app').evaluate(e=>e.inert));
 await page.keyboard.press('Escape');check('Escape closes modal',!(await page.locator('#modal').getAttribute('class')||'').includes('open'));
 await nav(page,'overview');await page.locator('[data-action=lang]').click();check('Bangla switch',await page.locator('html').getAttribute('lang')==='bn');
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:new URL('admin-bangla.png',output).pathname,fullPage:true});await page.locator('[data-action=lang]').click();
 const mod=await context.newPage();mod.on('pageerror',e=>errors.push(e.message));await login(mod,'moderator','rahim');
 check('moderator panel loads',await mod.locator('.sidebar').isVisible());
 const modViolations=[];
 const modIds=await mod.locator('.sidebar [data-page]').evaluateAll(es=>es.map(e=>e.dataset.page));
 for(const mode of ['light','dark']){
  if(await mod.locator('html').getAttribute('data-theme')!==mode)await mod.locator('[data-action=theme]').click();
  for(const id of modIds){await nav(mod,id);check(mode+' moderator '+id,await mod.locator('#content').textContent());const bad=await contrast(mod);if(bad.length)modViolations.push({mode,page:id,bad});}
 }
 check('moderator control contrast',modViolations.length===0);
 await nav(mod,'calendar');await mod.locator('[data-action=open-post]').filter({hasText:'UBEI QA Admission'}).first().click();
 const form=mod.locator('[data-form=submit-share]').first();await form.locator('[name=link]').fill('https://www.facebook.com/share/p/QAModToken');await form.locator('[type=submit]').click();
 check('moderator can submit a link',(await mod.locator('#modal').textContent()).includes('Pending'));
 await mod.keyboard.press('Escape');await page.reload();await nav(page,'verify');await page.locator('#q').fill('UBEI QA Admission');
 await page.locator('[data-action=verify][data-s=verified]').first().click();
 check('admin can verify moderator submission',true);
 await mod.reload();await nav(mod,'shares');check('verified share visible to moderator',(await mod.locator('#content').textContent()).includes('Verified'));
 await mod.setViewportSize({width:390,height:844});await nav(mod,'home');
 check('mobile bottom navigation',await mod.locator('.bottom-nav').isVisible());
 check('mobile page has no horizontal overflow',await mod.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mod.screenshot({path:new URL('moderator-mobile-dark.png',output).pathname,fullPage:true});
 check('no browser runtime errors',errors.length===0);
 await fs.writeFile(new URL('browser-results.json',output),JSON.stringify({checks,errors,contrastViolations:violations},null,2));
 console.log('PASS',checks,'browser checks');
}finally{await browser?.close();server.kill('SIGTERM');}
