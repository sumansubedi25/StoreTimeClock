import type {Transaction} from 'firebase-admin/firestore';
import {firestore,managerUid} from './firebase-admin';
import {root} from './firebase-store';
import {storeMeta,storeRole} from './store-policy';
import {fail} from './firebase-clock';
// Only metadata and individual binding records: never load business collections.
// Repeat within the mutation transaction so reassignment cannot race the preflight.
export async function storePreflight(uid:string,id:string,managerOnly=false,tx?:Transaction){
 const get=(ref:ReturnType<ReturnType<typeof firestore>['doc']>)=>tx?tx.get(ref):ref.get();
 const doc=await get(root(id));
 const raw=doc.data()??{},meta=storeMeta(id,raw,managerUid()),access=storeRole(uid,meta,managerUid());
 if(managerOnly&&access!=='manager')fail('Manager access required.',403);
 let personal:string|null=null;
 if(!access&&!managerOnly){
  const claim=await get(firestore().doc('storeAccounts/'+uid));
  const employee=claim.data()?.role==='employee'?claim.data()?.stores?.[id]:null;
  if(typeof employee==='string'&&/^[\w-]{1,128}$/.test(employee)){
   const link=await get(root(id).collection('employeeAccess').doc(employee));
   const record=await get(root(id).collection('generations').doc(raw.generation??'initial').collection('employees').doc(employee));
   if(link.data()?.uid===uid&&record.exists&&!record.data()?.archivedAt)personal=employee;
  }
 }
 if(!access&&!personal)fail('This account is not authorized for this store.',403);
 if(!doc.exists&&id!=='main')fail('Store not found.',404);
 return {access,personal,meta,raw};
}
export function authorizeClockAction(gate:Awaited<ReturnType<typeof storePreflight>>,action:string){
 if(gate.personal||gate.access==='kiosk'){if(!['in','out'].includes(action))fail('This account can only clock employees in and out.',403);}
}
