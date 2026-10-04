import {employeeBinding,checkOtherStores} from '../../../lib/employee-access';
import {firestore,adminAuth,authenticatedUser,managerUid} from '../../../lib/firebase-admin';
import {readState,snapshot,persist,root,createBackup,listBackups,getBackup,restorePayload} from '../../../lib/firebase-store';
import type {State} from '../../../lib/firebase-store';
import {ClockError,applyAction,clockStatus,fail,verifyPin} from '../../../lib/firebase-clock';
import {validStoreId,storeMeta,storeRole,allowedAction,sameOrigin} from '../../../lib/store-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const known=new Set(['setup','report','payroll','get_kiosk','set_kiosk','get_store','set_store','add','set_pay','edit_employee','save_shift','delete_shift','in','out','backup_list','backup_create','backup_download','backup_restore','backup_import']);
const readOnly=new Set(['report','payroll','get_kiosk','get_store','backup_list','backup_create','backup_download','backup_restore','backup_import']);
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function role(user:{uid:string},state:State){return storeRole(user.uid,state,managerUid());}
function selectedStore(req:Request){const id=req.headers.get('x-store-id');if(!validStoreId(id))fail('Choose a valid store.',400);return id;}
function errorResponse(e:unknown){if(e instanceof ClockError)return json({error:e.message},e.status);console.error('Clock request failed',e instanceof Error?e.message:'Unknown error');return json({error:'Could not complete the request. Refresh to check the current status before retrying.'},503);}
export async function GET(req:Request){try{const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);const storeId=selectedStore(req),meta=await root(storeId).get();if(!meta.exists&&storeId!=='main')fail('Store not found.',404);if(!storeRole(user.uid,storeMeta(storeId,meta.data()??{},managerUid()),managerUid()))fail('This account is not authorized for this store.',403);const state=await snapshot(storeId),access=role(user,state);if(!access)return json({error:'This account is not authorized for this store.'},403);return json(clockStatus(state,access==='kiosk'));}catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'Request not allowed.'},403);
 const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);
 const storeId=selectedStore(req);
 const text=await req.text();if(Buffer.byteLength(text)>20000000)return json({error:'Upload too large (maximum 20 MB).'},413);
 let p:any;try{p=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}
 if(!p||typeof p!=='object'||!known.has(p.action))return json({error:'Unknown action.'},400);
 // The designated manager can enable only an existing Firebase Auth account.
 if(p.action==='set_kiosk'){
  const meta=await root(storeId).get();
  if(!meta.exists&&storeId!=='main')fail('Store not found.',404);
  const info=storeMeta(storeId,meta.data()??{},managerUid());
  if(storeRole(user.uid,info,managerUid())!=='manager')return json({error:'Manager access required.'},403);
  const email=String(p.email??'').trim().toLowerCase();p.kioskUid='';
  if(email){let account;try{account=await adminAuth().getUserByEmail(email);}catch{return json({error:'Create this store account in Firebase Authentication first.'},400);}if(account.uid===managerUid())return json({error:'Use a separate store account.'},400);if(account.disabled)return json({error:'This store account is disabled.'},400);p.kioskUid=account.uid;}
 }
 const result=await firestore().runTransaction(async tx=>{
  const before=await readState(tx,storeId),access=role(user,before);
  const personal=access?null:await employeeBinding(tx,user.uid,storeId,before);
  if(!access&&!personal)fail('This account is not authorized for this store.',403);
  if(personal){if(!['in','out'].includes(p.action))fail('Employee access only allows personal punches.',403);if(p.employee&&p.employee!==personal)fail('You can only clock yourself in or out.',403);p.employee=personal;}
  if(!personal&&!allowedAction(access,p.action))fail('This store account can only clock employees in and out.',403);
  // Tablet identities cannot be managers or assigned to another store.
  let tabletClaim:null|ReturnType<ReturnType<typeof firestore>['doc']>=null;
  let previousClaim:null|ReturnType<ReturnType<typeof firestore>['doc']>=null;
  if(p.action==='set_kiosk'&&before.kioskUid&&before.kioskUid!==p.kioskUid){
   const ref=firestore().doc('storeAccounts/'+before.kioskUid),claim=await tx.get(ref);
   if(claim.data()?.role==='kiosk'&&claim.data()?.storeId===storeId)previousClaim=ref;
  }
  if(p.action==='set_kiosk'&&p.kioskUid){
   const managers=await tx.get(firestore().collection('stores').where('managerUid','==',p.kioskUid));
   const tablets=await tx.get(firestore().collection('stores').where('kioskUid','==',p.kioskUid));
   const ref=firestore().doc('storeAccounts/'+p.kioskUid),claim=await tx.get(ref);
   if(p.kioskUid===before.managerUid||!managers.empty||tablets.docs.some(d=>d.id!==storeId)||['manager','employee'].includes(claim.data()?.role)||(claim.exists&&claim.data()?.storeId!==storeId))fail('Use a separate tablet account that is not assigned to another store or manager.');
   tabletClaim=ref;
  }
  const employee=before.employees.find(e=>e.id===p.employee);
  const isPunch=['in','out'].includes(p.action);
  const requiresPin=!personal&&p.action!=='setup'&&!(p.action==='backup_import'&&!before.hash);
  // Separate lockout counters stop one employee from locking out the manager.
  const gateRef=root(storeId).collection('attempts').doc(isPunch&&employee?'employee-'+employee.id:'manager');
  const gateDoc=requiresPin?await tx.get(gateRef):null;const gate=gateDoc?.data();const now=Date.now();
  if(requiresPin){
   if(!before.hash)fail('Set a manager PIN or import your existing backup first.');
   if(isPunch&&!employee)fail('Choose an employee.');
   if(gate&&gate.count>=5&&gate.until>now)return {error:'Too many incorrect PINs. Try again in 5 minutes.',status:429};
   if(!verifyPin(p.pin,isPunch?employee!.hash:before.hash)){tx.set(gateRef,{count:gate&&gate.until>now?gate.count+1:1,until:now+300000});return {error:'Incorrect PIN.',status:403};}
  }
  if(p.action==='in')await checkOtherStores(tx,before,p.employee,'in',now,null);
  if(p.action==='save_shift')await checkOtherStores(tx,before,p.employee,'save_shift',p.start,p.end);
  const after=structuredClone(before);
  let data:any={ok:true};
  if(!p.action.startsWith('backup_'))try{data=applyAction(after,p,now);}catch(e){if(e instanceof ClockError)throw e;fail(e instanceof Error?e.message:'Invalid request.');}
  if(requiresPin&&gateDoc?.exists)tx.delete(gateRef);
  if(previousClaim)tx.delete(previousClaim);
  if(tabletClaim)tx.set(tabletClaim,{role:'kiosk',storeId});
  const changed=!readOnly.has(p.action);if(changed)persist(tx,before,after);
  return {data,state:changed?{...after,revision:before.revision+1}:before,changed};
 });
 if('error' in result)return json({error:result.error},result.status);
 const state=result.state!;
 if(p.action==='backup_list')return json({backups:await listBackups(storeId)});
 if(p.action==='backup_create')return json({ok:true,backup:await createBackup(state)});
 if(p.action==='backup_download'){const payload=await getBackup(storeId,String(p.key??''));return new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Content-Disposition':`attachment; filename="time-clock-${storeId}-backup.json"`}});}
 if(p.action==='backup_restore'||p.action==='backup_import'){
  const payload=p.action==='backup_import'?p.payload:await getBackup(storeId,String(p.key??''));
  let restored;
  try{await createBackup(state,'before-restore');restored=await restorePayload(payload,state);}catch(e){return json({error:e instanceof Error?e.message:'Restore failed.'},400);}
  try{await createBackup(await snapshot(storeId),'after-restore');return json({ok:true,restored});}catch{return json({ok:true,restored,backupWarning:'Restore completed, but the new backup failed. Create a manager backup.'});}
 }
 if(result.changed){try{await createBackup(state,'automatic');}catch{console.error('Automatic backup failed');return json({...result.data,backupWarning:'Change saved, but automatic backup failed. Create a manager backup.'});}}
 return json(result.data);
 }catch(e){return errorResponse(e);}}
