import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer \S+$/i.test(authorization))return json({error:'Login required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,publicKey=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 if(!url||!publicKey||!secret)return json({error:'Account service configuration is incomplete'},503);
 const auth=createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await auth.auth.getUser();
 if(authError||!identity.user)return json({error:'Session expired. Log in again.'},401);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:actor,error:actorError}=await admin.from('profiles').select('id,role,active').eq('id',identity.user.id).single();
 if(actorError||!actor?.active||!['admin','superadmin'].includes(actor.role))return json({error:'Admin access required'},403);
 let createdId:string|undefined;
 try{
  if(Number(request.headers.get('content-length')||0)>50000)throw new Error('Request is too large');
  const body=await request.json();const action=body.action;
  if(!['create','update','archive'].includes(action))throw new Error('Invalid account action');
  const fields=body.fields||{},id=body.id;
  if(Object.keys(fields).some(k=>!['name','username','role','active','fb','photo','color'].includes(k)))throw new Error('Unexpected account field');
  let target:Record<string,unknown>|null=null;
  if(action!=='create'){
   if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid account');
   const result=await admin.from('profiles').select('*').eq('id',id).single();if(result.error)throw new Error('Account not found');target=result.data;
   if(!Number.isInteger(body.version)||body.version!==target?.version)throw new Error('Record changed on another device. Refresh and try again.');
  }
  const desiredRole=fields.role||target?.role||'moderator';
  if(actor.role!=='superadmin'&&(desiredRole!=='moderator'||target&&target.role!=='moderator'))return json({error:'Super Admin access required'},403);
  if(id===actor.id&&(action==='archive'||fields.active===false||desiredRole!==actor.role))throw new Error('You cannot change your own role or active status');
  if(action==='archive'){
   const result=await admin.rpc('sharehub_admin_member',{actor_id:actor.id,member_id:id,fields:{active:false},contact:{},expected_version:body.version});if(result.error)throw result.error;
   return json({id,archived:true});
  }
  const email=String(body.email||'').trim(),password=body.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('A valid login email is required');
  if((action==='create'||password)&&(typeof password!=='string'||password.length<10||password.length>128))throw new Error('Use a password of 10 to 128 characters');
  if(!fields.name||String(fields.name).length>100||!String(fields.name).trim())throw new Error('Enter a name (up to 100 characters)');
  if(!/^[A-Za-z0-9_.]{3,30}$/.test(fields.username||''))throw new Error('Invalid username');
  if(!['admin','superadmin','moderator'].includes(desiredRole))throw new Error('Invalid role');
  let memberId=id;
  if(action==='create'){
   // No paid email provider is needed: administrator supplies initial credentials privately.
   const result=await admin.auth.admin.createUser({email,password,email_confirm:true});if(result.error)throw result.error;
   memberId=result.data.user.id;createdId=memberId;
  }
  const saved=await admin.rpc('sharehub_admin_member',{actor_id:actor.id,member_id:memberId,fields:{...fields,role:desiredRole},contact:{email,phone:String(body.phone||'')},expected_version:body.version??null});
  if(saved.error)throw saved.error;
  createdId=undefined;
  if(action==='update'){
   // Auth and Postgres are different APIs. Report partial failure explicitly; never pretend this is atomic.
   const result=await admin.auth.admin.updateUserById(memberId,{email,email_confirm:true,...(password?{password}:{})});
   if(result.error){
    const current=await admin.auth.admin.getUserById(memberId);
    if(current.data.user?.email)await admin.from('profile_contacts').update({email:current.data.user.email}).eq('id',memberId);
    return json({error:'Profile saved, but login credentials were not updated: '+result.error.message},409);
   }
  }
  return json({id:memberId,created:action==='create'});
 }catch(error){
  if(createdId)await admin.auth.admin.deleteUser(createdId);
  const message=error instanceof Error?error.message:String((error as {message?:string})?.message||'Account update failed');
  return json({error:message},400);
 }
});
