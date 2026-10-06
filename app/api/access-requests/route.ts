import {ensureStoreAccessCode,validAccessCode} from '../../../lib/store-access-code';
import {randomUUID} from 'node:crypto';
import {adminAuth,authenticatedUser,firestore,managerUid} from '../../../lib/firebase-admin';
import {readState,root,persist} from '../../../lib/firebase-store';
import {verifyPin,fail,ClockError,audit} from '../../../lib/firebase-clock';
import {sameOrigin,validStoreId,storeRole} from '../../../lib/store-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const publicRequest=(d:any)=>({storeId:d.storeId,storeName:d.storeName,name:d.name,email:d.email,status:d.status,createdAt:d.createdAt});
export async function GET(req:Request){try{
 const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);
 const q=await firestore().doc('accessRequests/'+user.uid).collection('stores').get();
 return json({requests:q.docs.map(d=>publicRequest(d.data()))});
}catch{return json({error:'Could not load your requests.'},503);}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))fail('Request not allowed.',403);
 const user=await authenticatedUser(req);if(!user)fail('Sign in to continue.',401);
 const body=await req.text();if(Buffer.byteLength(body)>10000)fail('Request too large.');
 let p:any;try{p=JSON.parse(body);}catch{fail('Invalid request.');}
 if(!['submit','list','approve','reject'].includes(p?.action))fail('Unknown action.');
 let selectedId=req.headers.get('x-store-id');
 if(p.action==='submit'){if(user.email_verified!==true)fail('Verify your email before requesting access.',403);if(!validAccessCode(p.accessCode))fail('Enter the six-digit store code provided by your manager.');const registry=await firestore().doc('storeAccessCodes/'+p.accessCode).get();selectedId=registry.data()?.storeId??null;}
 if(!validStoreId(selectedId))fail('Store code not found. Check the six-digit code with your manager.');
 const id=selectedId;
 let account:any;
 if(p.action==='approve'){
  if(typeof p.uid!=='string'||! /^[\w-]{1,128}$/.test(p.uid))fail('Choose a request.');
  try{account=await adminAuth().getUser(p.uid);}catch{fail('Employee login no longer exists.');}
  if(account.disabled||!account.emailVerified||account.uid===managerUid())fail('Use an enabled, verified employee login.');
 }
 const result=await firestore().runTransaction(async tx=>{
  const state=await readState(tx,id),now=Date.now();
  if(p.action==='submit'){
   if(user.email_verified!==true||typeof user.email!=='string')fail('Verify your email before requesting access.',403);
   const name=typeof p.name==='string'?p.name.trim():'';if(!name||name.length>80)fail('Enter your name (up to 80 characters).');
   const claim=await tx.get(firestore().doc('storeAccounts/'+user.uid));
   const managers=await tx.get(firestore().collection('stores').where('managerUid','==',user.uid)),kiosks=await tx.get(firestore().collection('stores').where('kioskUid','==',user.uid));
   if(user.uid===managerUid()||!managers.empty||!kiosks.empty||(claim.exists&&claim.data()?.role!=='employee'))fail('Use a separate employee login.',403);
   if(claim.data()?.stores?.[id])fail('You already have access to this store.');
   const own=firestore().doc('accessRequests/'+user.uid).collection('stores'),all=await tx.get(own),existing=all.docs.find(d=>d.id===id)?.data();
   if(existing?.status==='pending')return {data:{ok:true}};
   if(existing&&now-existing.createdAt<86400000)fail('Wait 24 hours before requesting this store again.',429);
   if(!existing&&all.size>=10)fail('Contact the owner to request another store.',429);
   const data={uid:user.uid,storeId:id,storeName:state.name,name,email:user.email.toLowerCase(),status:'pending',createdAt:now};
   tx.set(root(id).collection('accessRequests').doc(user.uid),data);tx.set(own.doc(id),data);
   return {data:{ok:true}};
  }
  if(storeRole(user.uid,state,managerUid())!=='manager')fail('Manager access required.',403);
  const gateRef=root(id).collection('attempts').doc('manager'),gateDoc=p.action==='list'?null:await tx.get(gateRef),gate=gateDoc?.data();
  if(p.action!=='list'&&!p.pin)fail('Enter your manager PIN to authorize this change.',403);
  if(gate&&gate.count>=5&&gate.until>now)return {error:'Too many incorrect PINs. Try again in 5 minutes.',status:429};
  if(p.action!=='list'&&(!state.hash||!verifyPin(p.pin,state.hash))){tx.set(gateRef,{count:gate&&gate.until>now?gate.count+1:1,until:now+300000});return {error:'Incorrect manager PIN.',status:403};}
  const requests=await tx.get(root(id).collection('accessRequests'));
  const links=await tx.get(root(id).collection('employeeAccess'));
  if(p.action==='list'){return {data:{storeId:id,requests:requests.docs.filter(d=>d.data().status==='pending').map(d=>({uid:d.id,...publicRequest(d.data())})),employees:state.employees.filter(e=>!e.archivedAt).map(e=>({id:e.id,name:e.name,linked:links.docs.some(d=>d.id===e.id)}))}};}
  const request=requests.docs.find(d=>d.id===p.uid)?.data();if(!request||request.status!=='pending')fail('This request has already been handled. Refresh the list.',409);
  let employeeId:string|undefined;
  const after=structuredClone(state);
  if(p.action==='approve'){
   if(account.email?.toLowerCase()!==request.email)fail('Employee email changed. Ask them to submit a new request.');
   const accountRef=firestore().doc('storeAccounts/'+account.uid),claim=await tx.get(accountRef);
   const managers=await tx.get(firestore().collection('stores').where('managerUid','==',account.uid)),kiosks=await tx.get(firestore().collection('stores').where('kioskUid','==',account.uid));
   if(!managers.empty||!kiosks.empty||(claim.exists&&claim.data()?.role!=='employee'))fail('This account is a manager or tablet.');
   if(claim.data()?.stores?.[id])fail('This account already has store access.',409);
   for(const [otherId,otherEmployee] of Object.entries(claim.data()?.stores??{})){const other=await readState(tx,otherId);if(other.shifts.some(s=>s.employee===otherEmployee&&s.end===null))fail('Employee must clock out at all stores before adding access.');}
   if(p.employee){const employee=state.employees.find(e=>e.id===p.employee&&!e.archivedAt);if(!employee)fail('Choose an active employee.');if(links.docs.some(d=>d.id===employee.id))fail('That employee already has a login.');if(state.shifts.some(s=>s.employee===employee.id&&s.end===null))fail('Clock this employee out before linking access.');employeeId=employee.id;}
   else {employeeId=randomUUID();after.employees.push({id:employeeId,name:request.name,hash:null});}
   tx.set(accountRef,{role:'employee',stores:{...(claim.data()?.stores??{}),[id]:employeeId}});
   tx.set(root(id).collection('employeeAccess').doc(employeeId!),{uid:account.uid,email:request.email});
  }
  const resolved={...request,status:p.action==='approve'?'approved':'rejected',resolvedAt:now,resolvedBy:user.uid,...(employeeId?{employee:employeeId}:{})};
  tx.set(root(id).collection('accessRequests').doc(p.uid),resolved);tx.set(firestore().doc('accessRequests/'+p.uid).collection('stores').doc(id),resolved);
  
  if(gateDoc?.exists)tx.delete(gateRef);
  audit(after,'access_'+p.action,request.name,'Employee access request '+resolved.status,null,{email:request.email,employee:employeeId??null});persist(tx,state,after);
  return {data:{ok:true}};
 });
 if('error' in result)return json({error:result.error},result.status);if(p.action==='list')return json({...result.data,accessCode:await ensureStoreAccessCode(id)});return json(result.data);
}catch(e){return json({error:e instanceof ClockError?e.message:'Could not complete access request. Check the store code and try again.'},e instanceof ClockError?e.status:503);}}
