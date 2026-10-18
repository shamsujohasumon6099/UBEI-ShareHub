import {createClient} from '@supabase/supabase-js';
import {CONFIG, MODE} from '../lib/config.js';
import {emptyDB,cleanLink} from '../lib/domain.js';
// The two panels may hold different accounts in the same browser, as in the original product.
const scope=document.body.dataset.role==='moderator'?'moderator':'admin';
const AUTH_KEY='ubei-sharehub-auth-v1-'+scope, REMEMBER='ubei-sharehub-remember-'+scope;
let remember=true;
try { remember=localStorage.getItem(REMEMBER)!=='false'; } catch { /* session memory remains usable */ }
const volatile=new Map();
const storage={
  getItem(key){try{return sessionStorage.getItem(key)||localStorage.getItem(key)||volatile.get(key)||null;}catch{return volatile.get(key)||null;}},
  setItem(key,value){volatile.set(key,value);try{(remember?localStorage:sessionStorage).setItem(key,value);(remember?sessionStorage:localStorage).removeItem(key);}catch{/* in-memory session */}},
  removeItem(key){volatile.delete(key);try{localStorage.removeItem(key);sessionStorage.removeItem(key);}catch{/* unavailable */}},
};
const client=MODE==='cloud'?createClient(CONFIG.url,CONFIG.key,{
  auth:{storage,storageKey:AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
  global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)})},
}):null;
const fields={
  profiles:{name:'name',username:'username',role:'role',active:'active',fb:'fb',photo:'photo',color:'color'},
  profile_contacts:{email:'email',phone:'phone',last_login:'lastLogin',notif_seen:'notifSeen',notice_seen:'noticeSeen'},
  posts:{title:'title',caption:'caption',tag:'tag',date:'date',time:'time',image:'image',fb_link:'fbLink',assignment:'assign',assignees:'assignees',group_share:'groupShare',group_tasks:'groupTasks',created_at:'createdAt',created_by:'createdBy',updated_at:'updatedAt',updated_by:'updatedBy'},
  shares:{post_id:'postId',user_id:'userId',group_id:'groupId',link:'link',status:'status',note:'note',submitted_at:'submittedAt',first_at:'firstAt',edited_at:'editedAt',checked_at:'checkedAt',checked_by:'checkedBy'},
  groups:{name:'name',url:'url',note:'note',active:'active',created_at:'createdAt'},
  app_settings:{page_name:'pageName',page_url:'pageUrl',deadline_hours:'deadlineHours',notice:'notice',hide_setup:'hideSetup',last_backup:'lastBackup'},
};
const editable={
  profiles:['name','username','role','active','fb','photo','color'],
  profile_contacts:['email','phone','notif_seen','notice_seen'],
  posts:['title','caption','tag','date','time','image','fb_link','assignment','assignees','group_share','group_tasks'],
  shares:['post_id','user_id','group_id','link','status','note'],
  groups:['name','url','note','active'],
  app_settings:Object.keys(fields.app_settings),
};
const copy=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
let revision='',loadedAt=0;
let baseline=emptyDB(), raw={}, urls=new Map(), sessionUser=null, channel=null;
const unpack=(table,row)=>Object.fromEntries([['id',row.id],...Object.entries(fields[table]).map(([key,ui])=>[ui,row[key]??(['active','group_share','hide_setup'].includes(key)?false:null)])]);
function ensure(result){if(result.error)throw result.error;return result.data;}
function rowsFor(db,table){return table==='profiles'||table==='profile_contacts'?db.users:table==='app_settings'?[{id:'main',...db.settings}]:db[table];}
function valueFor(item,table,key){const value=item[fields[table][key]];return value===undefined?null:value;}
async function media(value){
  if (!value || !value.startsWith('data:')) return urls.get(value)||value||'';
  if (!/^data:image\/jpeg;base64,/.test(value)) throw new Error('Use a JPEG image');
  const bytes = Uint8Array.from(
  atob(value.slice(value.indexOf(',') + 1)),
  char => char.charCodeAt(0)
);
const blob = new Blob([bytes], {type: 'image/jpeg'});
  if(blob.size>1048576)throw new Error('The compressed image must be smaller than 1 MB');
  const user=sessionUser||ensure(await client.auth.getUser()).user;
  const path=`${user.id}/${crypto.randomUUID()}.jpg`;
  ensure(await client.storage.from('sharehub-media').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'}));
  return 'storage:'+path;
}
export const Cloud={
  client,
  onAuthChange:fn=>client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>fn(event,session?.user||null),0);}),
  recordVersion:(table,id)=>raw[table]?.find(p=>p.id===id)?.version,
  memberVersion:id=>raw.profiles?.find(p=>p.id===id)?.version,
  baseline:()=>copy(baseline),
  exportBackup:()=>({format:'ubei-sharehub-v3',exportedAt:new Date().toISOString(),snapshot:copy(raw)}),
  async restore(){const data=ensure(await client.auth.getSession());if(!data.session)return null;sessionUser=ensure(await client.auth.getUser()).user;return sessionUser;},
  async login(email,password,keep){remember=keep;try{localStorage.setItem(REMEMBER,String(keep));}catch{/* optional preference */}const data=ensure(await client.auth.signInWithPassword({email,password}));sessionUser=data.user;return data.user;},
  async logout(){sessionUser=null;if(channel){await client.removeChannel(channel);channel=null;}try{await client.auth.signOut({scope:'local'});}finally{storage.removeItem(AUTH_KEY);baseline=emptyDB();raw={};urls.clear();}},
  async changePassword(current,password){
    // Reauthenticate with an isolated, non-persisted client, without replacing this session.
    const authClient=createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const currentUser=ensure(await client.auth.getUser()).user;
    const {data,error}=await authClient.auth.signInWithPassword({email:currentUser.email,password:current});
    if(error)throw new Error('Current password is wrong');
    try {ensure(await client.auth.updateUser({password}));} finally {if(data.session)await authClient.auth.signOut({scope:'local'});}
  },
  async touchLogin(){ensure(await client.rpc('sharehub_touch_login'));},
  async maybeLoad(force=false){
    const next=ensure(await client.rpc('sharehub_revision'));
    return force||next!==revision||Date.now()-loadedAt>50*60000?this.load():null;
  },
  async load(){
    const data=ensure(await client.rpc('sharehub_snapshot'));
    const paths=[...new Set(['profiles','posts'].flatMap(t=>(data[t]||[]).map(row=>t==='profiles'?row.photo:row.image)).filter(s=>s?.startsWith('storage:')))];
    const resolved=new Map();
    if(paths.length){
      const signed=ensure(await client.storage.from('sharehub-media').createSignedUrls(paths.map(p=>p.slice(8)),3600));
      signed.forEach((x,i)=>{if(!x.error&&x.signedUrl)resolved.set(paths[i],x.signedUrl);});
    }
    const db=emptyDB();urls=new Map();
    const asset=s=>{if(!s?.startsWith('storage:'))return s||'';const url=resolved.get(s)||'';if(url)urls.set(url,s);return url;};
    const contacts=new Map((data.profile_contacts||[]).map(x=>[x.id,unpack('profile_contacts',x)]));
    db.users=(data.profiles||[]).map(row=>({...unpack('profiles',row),...contacts.get(row.id),photo:asset(row.photo)}));
    db.posts=(data.posts||[]).map(row=>({...unpack('posts',row),time:(row.time||'00:00').slice(0,5),image:asset(row.image)}));
    db.shares=(data.shares||[]).map(row=>unpack('shares',row));
    db.groups=(data.groups||[]).map(row=>unpack('groups',row));
    db.settings={...db.settings,...(data.app_settings?.[0]?unpack('app_settings',data.app_settings[0]):{}),demo:false};delete db.settings.id;
    db.log=(data.audit_log||[]).map(row=>({id:String(row.id),at:row.at,by:row.by,type:row.type,text:row.text,vars:row.vars}));
    raw=data;revision=data.revision;loadedAt=Date.now();baseline=copy(db);return db;
  },
  async save(db){
    const changes=[],role=db.users.find(u=>u.id===sessionUser?.id)?.role;
    // Child deletions precede parent deletions. An action updates only the fields it changed.
    for(const table of ['shares','posts','groups','profiles','profile_contacts','app_settings']){
      const before=new Map(rowsFor(baseline,table).map(x=>[x.id,x]));
      const after=new Map(rowsFor(db,table).map(x=>[x.id,x]));
      const dbRows=new Map((raw[table]||[]).map(x=>[x.id,x]));
      for(const [id,old] of before){
        if(!after.has(id)&&dbRows.has(id))changes.push({table,id,version:dbRows.get(id).version,operation:'delete'});
      }
      for(const [id,item] of after){
        const old=before.get(id),row=dbRows.get(id);
        // A moderator cannot see anyone else's private row; it must never be created implicitly.
        if(table==='profile_contacts'&&!row)continue;
        const values={};
        for(const key of editable[table]){
          if(table==='profile_contacts'&&key==='email')continue; // Auth identity is handled by manage-user.
          if(table==='shares'&&role==='moderator'&&['status','note'].includes(key))continue;
          if(table==='shares'&&old&&['post_id','user_id','group_id'].includes(key))continue;
          const next=valueFor(item,table,key),prev=old?valueFor(old,table,key):undefined;
          if(old&&equal(next,prev))continue;
          if(!old&&next===null)continue;
          values[key]=['image','photo'].includes(key)?await media(next):['link','fb_link','url','fb','page_url'].includes(key)?(next?cleanLink(next):''):next;
        }
        if(Object.keys(values).length)changes.push({table,id,version:row?.version||0,operation:'upsert',values});
      }
    }
    if(changes.length)ensure(await client.rpc('sharehub_apply',{changes}));
    return this.load();
  },
  async manageMember(payload){
    if(payload.fields?.photo)payload.fields.photo=await media(payload.fields.photo);
    const {data,error}=await client.functions.invoke('manage-user',{body:payload});
    if(error){let message=error.message;try{const detail=await error.context.json();message=detail.error||message;}catch{/* not an HTTP response */}throw new Error(message);}
    if(data?.error)throw new Error(data.error);
    return data;
  },
  subscribe(onChange){
    if(channel)client.removeChannel(channel);
    let timer;
    channel=client.channel('ubei-sharehub-team');
    for(const table of ['posts','shares','groups','app_settings','profiles','profile_contacts'])channel.on('postgres_changes',{event:'*',schema:'public',table},()=>{clearTimeout(timer);timer=setTimeout(onChange,800);});
    channel.subscribe();return()=>{clearTimeout(timer);if(channel)client.removeChannel(channel);channel=null;};
  },
};
