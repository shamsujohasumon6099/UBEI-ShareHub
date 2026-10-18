/** Supabase-specific actions. Demo behaviour stays isolated in the original feature modules. */
import {MODE} from '../lib/config.js';
import {Cloud} from './cloud.js';
import {refreshCloud,errorText} from '../core/application.js';
import {cleanLink,isFbUrl} from '../lib/domain.js';
export function installCloudUI(ctx){
 if(MODE!=='cloud')return;
 const {ROLE,State,App,Forms,Actions,PAGES,render,openModal,closeModal,toast,T,esc,icon,commit,userById,confirmBox,normalizeDB}=ctx;
 Forms.login=async(f,fd)=>{
  const email=String(fd.get('username')||'').trim(), password=String(fd.get('password')||''),button=f.querySelector('[type=submit]');
  button.disabled=true;const err=f.querySelector('#loginErr');err.textContent='';
  try{
   const user=await Cloud.login(email,password,!!fd.get('keep'));
   State.db=normalizeDB(await Cloud.load());const member=userById(user.id);
   if(!member?.active)throw new Error('This account is inactive. Please contact an admin.');
   if(ROLE==='admin'?!['admin','superadmin'].includes(member.role):member.role!=='moderator')throw new Error('Use the login panel for your account role.');
   await Cloud.touchLogin();State.db=normalizeDB(await Cloud.load());App.user=userById(user.id);
   const h=location.hash.slice(1);App.page=PAGES[h]&&h!=='member'?h:ROLE==='admin'?'overview':'home';
   history.replaceState({page:App.page},'','#'+App.page);State.sync='saved';State.syncedAt=new Date();
   Cloud.subscribe(()=>refreshCloud());render();toast(T('Welcome, {name}!',{name:App.user.name.split(' ')[0]}));
  }catch(error){
   await Cloud.logout();State.db={users:[],posts:[],shares:[],groups:[],log:[],settings:{demo:false}};App.user=null;
   const message=/invalid login credentials/i.test(error.message)?T('Email or password is incorrect.'):errorText(error);
   err.textContent=message;
  }finally{button.disabled=false;}
 };
 Forms.password=async(f,fd)=>{
  const password=String(fd.get('pw')||'');
  if(password!==fd.get('pw2'))throw new Error('The new passwords do not match');
  if(password.length<10)throw new Error('Password needs at least 10 characters');
  await Cloud.changePassword(String(fd.get('current')||''),password);f.reset();toast(T('Password changed'));
 };
 Forms.profile=async(f,fd)=>{
  const user=userById(App.user.id),fb=String(fd.get('fb')||'').trim(),phone=String(fd.get('phone')||'').trim();
  if(fb&&!isFbUrl(fb))throw new Error('Enter a valid Facebook profile link');
  if(phone&&!/^\+?[\d\s()-]{10,20}$/.test(phone))throw new Error('Enter a valid WhatsApp number');
  if(fd.has('name')){const name=String(fd.get('name')||'').trim();if(!name||name.length>100)throw new Error('Enter a name (up to 100 characters)');user.name=name;}
  if(fd.has('phone'))user.phone=phone;
  user.fb=fb?cleanLink(fb):'';App.user=user;await commit(T('Profile saved'));
 };
 Forms.user=async(f,fd)=>{
  const id=String(fd.get('id')||''),old=id?userById(id):null;
  const name=String(fd.get('name')||'').trim(),username=String(fd.get('username')||'').trim();
  const email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||''),role=String(fd.get('role')||'moderator');
  if(!name||name.length>100)throw new Error('Enter a name (up to 100 characters)');
  if(!/^[A-Za-z0-9_.]{3,30}$/.test(username))throw new Error('3 to 30 letters, numbers, _ or .');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('A valid login email is required');
  if((!id||password)&&password.length<10)throw new Error('Password needs at least 10 characters');
  const fields={name,username,role,active:!!fd.get('active'),color:fd.get('color')||'#6366F1',fb:cleanLink(fd.get('fb')||old?.fb||'')};
  const photo=fd.get('photo');if(photo)fields.photo=String(photo);
  await Cloud.manageMember({action:id?'update':'create',id:id||undefined,version:id?Cloud.memberVersion(id):undefined,fields,email,phone:String(fd.get('phone')||old?.phone||''),password:password||undefined});
  closeModal();await refreshCloud(true);toast(T(id?'{name} updated':'{name} added',{name}));
 };
 for(const action of ['delete-mod','delete-admin'])Actions[action]=el=>{
  const u=userById(el.dataset.id);if(!u)return;
  confirmBox(T('Deactivate account?'),T('Their share history will be kept. They will lose access immediately.'),async()=>{
   await Cloud.manageMember({action:'archive',id:u.id,version:Cloud.memberVersion(u.id)});await refreshCloud(true);toast(T('Account deactivated'));
  },T('Deactivate'));
 };
 // A browser backup is an export of visible business records; Auth identities remain in Supabase.
 Actions['export-json']=async()=>{
  if(App.user.role!=='superadmin')return;
  State.db.settings.lastBackup=new Date().toISOString();if(!await commit())return;
  const data=Cloud.exportBackup();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='ubei-sharehub-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(T('Backup is downloading'));
 };
 for(const action of ['reset-demo','start-fresh'])Actions[action]=()=>toast(T('Demo resets are disabled for live data.'),'error');
 if(PAGES.settings){const original=PAGES.settings.render;PAGES.settings.render=()=>{
  const box=document.createElement('div');box.innerHTML=original();
  for(const selector of ['.storage','[data-action="reset-demo"]','[data-action="start-fresh"]','label[for="importFile"]','#importFile'])box.querySelector(selector)?.remove();
  for(const card of box.querySelectorAll('.card')){
   if(card.textContent.includes(T('Danger zone')))card.remove();
  }
  const textNodes=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);const nodes=[];while(textNodes.nextNode())nodes.push(textNodes.currentNode);
  const replacements=new Map([
   [T('Data is saved in this browser ({kb} KB)',{kb:Math.round(new Blob([JSON.stringify(State.db)]).size/1024)}),T('Business records are stored in Supabase.')],
   [T('In this version all data lives in this browser. To use the same data on another device, export a JSON backup and import it there. The online version (Supabase) will sync automatically.'),T('Your team shares one database. This export excludes passwords and login sessions. Restore instructions are in the setup guide.')],
  ]);
  for(const node of nodes)for(const [from,to] of replacements)if(node.textContent===from)node.textContent=to;
  return box.innerHTML;
 };}
 Actions['cloud-help']=()=>openModal({title:'UBEI ShareHub',body:'<p>'+esc(T('Use your email and password. Ask your Super Admin if you need access or a password reset.'))+'</p>',foot:'<button class="btn" data-action="close-modal">'+T('Close')+'</button>'});
 // Remove the obsolete browser-storage health banner in the live console.

}
