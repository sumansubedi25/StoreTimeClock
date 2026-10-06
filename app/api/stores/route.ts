import {ensureStoreAccessCode} from '../../../lib/store-access-code';
import {randomUUID} from 'node:crypto';
import {adminAuth,authenticatedUser,firestore,managerUid} from '../../../lib/firebase-admin';
import {storeMeta,storeRole,storeSettings,validStoreId,sameOrigin} from '../../../lib/store-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){try{
 const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);
 const owner=managerUid(),all=firestore().collection('stores');
 const snapshots=user.uid===owner?[await all.get()]:await Promise.all([all.where('managerUid','==',user.uid).get(),all.where('kioskUid','==',user.uid).get()]);
 const employeeClaim=await firestore().doc('storeAccounts/'+user.uid).get();
 const assigned=employeeClaim.data()?.role==='employee'?Object.keys(employeeClaim.data()?.stores??{}):[];
 const employeeDocs=await Promise.all(assigned.filter(validStoreId).map(id=>all.doc(id).get()));
 const docs=new Map(snapshots.flatMap(s=>s.docs).map(d=>[d.id,d.data()]));
 for(const d of employeeDocs)if(d.exists)docs.set(d.id,d.data()!);
 if(user.uid===owner&&!docs.has('main'))docs.set('main',{});
 const stores=[...docs].flatMap(([id,data])=>{const meta=storeMeta(id,data,owner),role=storeRole(user.uid,meta,owner)??(assigned.includes(id)?'employee':null);return role?[{id,name:meta.name,role,...(user.uid===owner?{managerEmail:meta.managerEmail,managerUid:meta.managerUid}:{})}]:[];}).sort((a,b)=>a.name.localeCompare(b.name));
 const withCodes=await Promise.all(stores.map(async s=>({...s,accessCode:await ensureStoreAccessCode(s.id)})));
 return json({owner:user.uid===owner,stores:withCodes});
 }catch(e){console.error('Store listing failed',e instanceof Error?e.message:'Unknown');return json({error:'Could not load store access. Try again.'},503);}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'Request not allowed.'},403);
 const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);
 if(user.uid!==managerUid())return json({error:'Only the account owner can create stores or assign managers.'},403);
 const body=await req.text();if(Buffer.byteLength(body)>10000)return json({error:'Request too large.'},413);
 let p:any;try{p=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
 if(!['create','assign_manager'].includes(p?.action))return json({error:'Unknown store action.'},400);
 const email=typeof p.managerEmail==='string'?p.managerEmail.trim().toLowerCase():'';
 if(!email)return json({error:'Enter the manager’s Firebase account email.'},400);
 let account;try{account=await adminAuth().getUserByEmail(email);}catch{return json({error:'Create that manager account in Firebase Authentication first.'},400);}
 if(account.disabled)return json({error:'That manager account is disabled.'},400);
 const id=p.action==='create'?randomUUID():p.storeId;
 if(!validStoreId(id))return json({error:'Invalid store.'},400);
 let settings:ReturnType<typeof storeSettings>|undefined;try{if(p.action==='create')settings=storeSettings(p);}catch(e){return json({error:e instanceof Error?e.message:'Invalid store settings.'},400);}
 const result=await firestore().runTransaction(async tx=>{
  const ref=firestore().doc('stores/'+id),doc=await tx.get(ref);
  if(p.action==='create'&&doc.exists)throw Error('Store already exists.');
  if(p.action==='assign_manager'&&!doc.exists&&id!=='main')throw Error('Store not found.');
  const kiosks=await tx.get(firestore().collection('stores').where('kioskUid','==',account.uid));
  const accountRef=firestore().doc('storeAccounts/'+account.uid),claim=await tx.get(accountRef);
  if(!kiosks.empty||['kiosk','employee'].includes(claim.data()?.role))throw Error('Use a separate manager account; this account is a tablet or employee.');
  const before=doc.data()??{};
  tx.set(ref,{...(settings??{}),managerUid:account.uid,managerEmail:email,revision:(before.revision??0)+1},{merge:true});
  tx.set(accountRef,{role:'manager'});
  tx.set(ref.collection('adminAudit').doc(randomUUID()),{at:Date.now(),action:p.action,actor:user.uid,beforeManagerUid:before.managerUid??(id==='main'?managerUid():''),afterManagerUid:account.uid});
  return {id};
 });
 return json({ok:true,...result});
 }catch(e){console.error('Store update failed',e instanceof Error?e.message:'Unknown');return json({error:e instanceof Error?e.message:'Could not update the store.'},400);}}
