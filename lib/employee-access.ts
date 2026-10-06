import {firestore} from './firebase-admin';
import {root,readState,type State} from './firebase-store';
import {fail} from './firebase-clock';
import type {Transaction} from 'firebase-admin/firestore';
export async function employeeBinding(tx:Transaction,uid:string,storeId:string,state:State){
 const claim=await tx.get(firestore().doc('storeAccounts/'+uid));
 const id=claim.data()?.role==='employee'?claim.data()?.stores?.[storeId]:null;
 if(typeof id!=='string'||!state.employees.some(e=>e.id===id&&!e.archivedAt))return null;
 const link=await tx.get(root(storeId).collection('employeeAccess').doc(id));
 return link.data()?.uid===uid?id:null;
}
export async function checkOtherStores(tx:Transaction,state:State,employee:string,action:string,start:number,end:number|null){
 const link=await tx.get(root(state.storeId).collection('employeeAccess').doc(employee));
 if(!link.exists)return;
 const account=await tx.get(firestore().doc('storeAccounts/'+link.data()!.uid));
 const entries=Object.entries(account.data()?.stores??{});
 for(const [id,otherEmployee] of entries){
  if(id===state.storeId)continue;
  const other=await readState(tx,id);
  if(other.shifts.some(s=>s.employee===otherEmployee&&s.start<(end??Infinity)&&(s.end??Infinity)>start))fail(action==='in'?'You are already clocked in or have an overlapping shift at another store.':'This shift overlaps a shift at another store.',409);
 }
}
