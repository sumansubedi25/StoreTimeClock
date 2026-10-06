import {boundedJson} from '../../../lib/request-body';
import {storePreflight} from '../../../lib/store-preflight';
import {adminAuth,authenticatedUser,firestore,managerUid} from '../../../lib/firebase-admin';
import {readState,root,persist} from '../../../lib/firebase-store';
import {employeeBinding} from '../../../lib/employee-access';
import {payroll,verifyPin,fail,ClockError,audit} from '../../../lib/firebase-clock';
import {sameOrigin,validStoreId,storeRole} from '../../../lib/store-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function error(e:unknown){return json({error:e instanceof ClockError?e.message:'Could not complete employee access. Try again.'},e instanceof ClockError?e.status:503);}
export async function GET(req:Request){try{
 const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);
 const period=new URL(req.url).searchParams.get('period');
 const result=await firestore().runTransaction(async tx=>{
  const claim=await tx.get(firestore().doc('storeAccounts/'+user.uid));
  if(claim.data()?.role!=='employee')fail('Employee access required.',403);
  const stores=[];
  for(const id of Object.keys(claim.data()?.stores??{})){
   if(!validStoreId(id))continue;
   const state=await readState(tx,id),employee=await employeeBinding(tx,user.uid,id,state);if(!employee)continue;
   let pay;try{pay=payroll({...state,employees:state.employees.filter(e=>e.id===employee),shifts:state.shifts.filter(s=>s.employee===employee),payRates:state.payRates.filter(r=>r.employee===employee)}, {period});}catch{fail('Choose a valid pay period.');}
   stores.push({id,name:state.name,employee,nameEmployee:state.employees.find(e=>e.id===employee)!.name,location:state.location,geofenceEnabled:state.geofenceEnabled,start:state.shifts.find(s=>s.employee===employee&&s.end===null)?.start??null,pay:pay.rows[0],shifts:state.shifts.filter(s=>s.employee===employee).map(s=>({id:s.id,start:s.start,end:s.end})).sort((a,b)=>b.start-a.start)});
  }
  return {stores};
 },{readOnly:true});return json(result);
 }catch(e){return error(e);}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'Request not allowed.'},403);
 const user=await authenticatedUser(req);if(!user)return json({error:'Sign in to continue.'},401);
 const id=req.headers.get('x-store-id');if(!validStoreId(id))fail('Choose a store.');
 await storePreflight(user.uid,id,true);
 const p=await boundedJson(req);
 if(!['list','link','unlink','archive'].includes(p.action))fail('Unknown action.');
 const email=typeof p.email==='string'?p.email.trim().toLowerCase():'';
 let account:any;if(p.action==='link'){try{account=await adminAuth().getUserByEmail(email);}catch{fail('Create this employee email in Firebase Authentication first.');}if(!account.emailVerified)fail('This employee must sign in and verify their email before you link access.');if(account.disabled||account.uid===managerUid())fail('Use an enabled, separate employee account.');}
 const result=await firestore().runTransaction(async tx=>{
  await storePreflight(user.uid,id,true,tx);
  const state=await readState(tx,id);if(storeRole(user.uid,state,managerUid())!=='manager')fail('Manager access required.',403);
  const gateRef=root(id).collection('attempts').doc('manager'),gateDoc=p.action==='list'?null:await tx.get(gateRef),gate=gateDoc?.data(),now=Date.now();
  if(p.action!=='list'&&!p.pin)fail('Enter your manager PIN to authorize this change.',403);
  if(gate&&gate.count>=5&&gate.until>now)return {error:'Too many incorrect PINs. Try again in 5 minutes.',status:429};
  if(p.action!=='list'&&(!state.hash||!verifyPin(p.pin,state.hash))){tx.set(gateRef,{count:gate&&gate.until>now?gate.count+1:1,until:now+300000});return {error:'Incorrect manager PIN.',status:403};}
  const links=await tx.get(root(id).collection('employeeAccess'));
  if(p.action==='list'){return {data:{employees:state.employees.map(e=>({id:e.id,name:e.name,archivedAt:e.archivedAt??null,email:links.docs.find(d=>d.id===e.id)?.data()?.email??''}))}};}
  const employee=state.employees.find(e=>e.id===p.employee);if(!employee)fail('Choose an employee.');if(employee.archivedAt)fail('This employee is archived.');
  if(state.shifts.some(s=>s.employee===p.employee&&s.end===null))fail('Clock this employee out before removing them or changing access.');
  const old=links.docs.find(d=>d.id===p.employee)?.data(),oldRef=old?firestore().doc('storeAccounts/'+old.uid):null,oldDoc=oldRef?await tx.get(oldRef):null;
  const newRef=account?firestore().doc('storeAccounts/'+account.uid):null,newDoc=newRef?await tx.get(newRef):null;
  if(account){
   const managers=await tx.get(firestore().collection('stores').where('managerUid','==',account.uid)),kiosks=await tx.get(firestore().collection('stores').where('kioskUid','==',account.uid));
   if(!managers.empty||!kiosks.empty||(newDoc?.exists&&newDoc.data()?.role!=='employee'))fail('Use an employee account that is not a manager or tablet.');
   const existing=newDoc?.data()?.stores?.[id];if(existing&&existing!==p.employee)fail('This email is already linked to another employee in this store.');
   for(const [otherId,otherEmployee] of Object.entries(newDoc?.data()?.stores??{})){const other=await readState(tx,otherId);if(other.shifts.some(s=>s.employee===otherEmployee&&s.end===null))fail('Clock out at all stores before changing account assignments.');}
  }
  if(oldRef&&old?.uid!==account?.uid){const entries={...(oldDoc?.data()?.stores??{})};delete entries[id];tx.set(oldRef,{role:'employee',stores:entries});}
  const linkRef=root(id).collection('employeeAccess').doc(p.employee);
  if(account){tx.set(newRef!,{role:'employee',stores:{...(newDoc?.data()?.stores??{}),[id]:p.employee}});tx.set(linkRef,{uid:account.uid,email});}else tx.delete(linkRef);
  
  if(gateDoc?.exists)tx.delete(gateRef);
  const after=structuredClone(state);if(p.action==='archive'){const record=after.employees.find(e=>e.id===p.employee)!;record.archivedAt=now;record.hash=null;}audit(after,p.action,employee.name,p.action==='archive'?'Employee removed from active staff; records archived':'Employee email access updated',{email:old?.email??''},{email:account?email:''});persist(tx,state,after);
  return {data:{ok:true},state:{...after,revision:state.revision+1}};
 });
 
 if('error' in result)return json({error:result.error},result.status);return json(result.data);
 }catch(e){return error(e);}}
