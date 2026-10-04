import {firestore,managerUid} from './firebase-admin';
import type {Transaction} from 'firebase-admin/firestore';
import {payPeriod} from './payroll';
import {storeMeta,type StoreMeta} from './store-policy';
export const TABLES=['employees','shifts','payRates','audit'] as const;
export type Row=Record<string,any>;
export type State=StoreMeta&{storeId:string;hash:string|null;revision:number;generation:string;employees:Row[];shifts:Row[];payRates:Row[];audit:Row[]};
export function root(storeId:string){return firestore().doc('stores/'+storeId);}
export function generationCollection(storeId:string,generation:string,table:string){return root(storeId).collection('generations').doc(generation).collection(table);}
export async function readState(tx:Transaction,storeId:string):Promise<State>{
 const doc=await tx.get(root(storeId)),meta=doc.data()??{};
 if(!doc.exists&&storeId!=='main')throw Error('Store not found.');
 const generation=meta.generation??'initial';
 const snapshots=await Promise.all(TABLES.map(t=>tx.get(generationCollection(storeId,generation,t))));
 const tables=Object.fromEntries(TABLES.map((t,i)=>[t,snapshots[i].docs.map(d=>({...d.data(),id:d.id}))]));
 return {...storeMeta(storeId,meta,managerUid()),storeId,hash:meta.hash??null,revision:meta.revision??0,generation,...tables} as State;
}
export async function snapshot(storeId:string){return firestore().runTransaction(tx=>readState(tx,storeId),{readOnly:true});}
export function persist(tx:Transaction,before:State,after:State){
 for(const table of TABLES){
  const old=new Map(before[table].map(r=>[r.id,JSON.stringify(r)]));
  for(const row of after[table]){if(old.get(row.id)!==JSON.stringify(row))tx.set(generationCollection(before.storeId,before.generation,table).doc(row.id),row);old.delete(row.id);}
  for(const id of old.keys())tx.delete(generationCollection(before.storeId,before.generation,table).doc(id));
 }
 tx.set(root(before.storeId),{name:after.name,location:after.location,geofenceEnabled:after.geofenceEnabled,hash:after.hash,kioskEmail:after.kioskEmail,kioskUid:after.kioskUid,generation:before.generation,revision:before.revision+1},{merge:true});
}
export function backupPayload(state:State){return {format:'store-time-clock-backup',version:1,storeId:state.storeId,storeName:state.name,owner:'firebase-'+state.storeId,createdAt:new Date().toISOString(),tables:{settings:state.hash?[{hash:state.hash}]:[],employees:state.employees,shifts:state.shifts,payRates:state.payRates,audit:state.audit,kioskAccess:state.kioskEmail?[{email:state.kioskEmail}]:[]}};}
export async function createBackup(state:State,kind='manual'){
 const key=crypto.randomUUID(),ref=root(state.storeId).collection('backups').doc(key),body=JSON.stringify(backupPayload(state));
 const writer=firestore().bulkWriter();
 // Separate chunks avoid Firestore's 1 MiB document limit, including Unicode.
 const chunks=body.match(/[\s\S]{1,60000}/g)??[];
 const writes=chunks.map((text,i)=>writer.set(ref.collection('chunks').doc(String(i).padStart(8,'0')),{text}));
 await Promise.all([...writes,writer.close()]);const uploaded=new Date().toISOString();const size=Buffer.byteLength(body);
 await ref.set({uploaded,size,kind,chunks:chunks.length,complete:true});
 return {key,uploaded,size};
}
export async function listBackups(storeId:string){const q=await root(storeId).collection('backups').orderBy('uploaded','desc').limit(100).get();return q.docs.map(d=>({key:d.id,...d.data()}));}
export async function getBackup(storeId:string,key:string){
 if(!/^[\w-]{1,100}$/.test(key))throw Error('Invalid backup.');
 const ref=root(storeId).collection('backups').doc(key),meta=await ref.get();if(!meta.data()?.complete)throw Error('Backup not found.');
 const q=await ref.collection('chunks').orderBy('__name__').get();if(q.size!==meta.data()?.chunks)throw Error('Backup is incomplete.');
 return JSON.parse(q.docs.map(d=>d.data().text).join(''));
}
export function validateBackup(payload:any,storeId?:string):Pick<State,'hash'|'employees'|'shifts'|'payRates'|'audit'>{
 if(payload?.format!=='store-time-clock-backup'||payload.version!==1)throw Error('Unsupported backup format.');
 if(storeId&&payload.storeId&&payload.storeId!==storeId)throw Error('This backup belongs to a different store.');
 const t=payload.tables;if(!t||!TABLES.every(k=>Array.isArray(t[k])))throw Error('Incomplete backup.');
 const hash=t.settings?.[0]?.hash??null;
 const validHash=(h:any)=>typeof h==='string'&&/^[\w-]+:[a-f0-9]{64}$/.test(h);
 if(hash!==null&&!validHash(hash))throw Error('Invalid manager PIN hash.');
 for(const table of TABLES){const seen=new Set();for(const row of t[table]){if(!row||typeof row.id!=='string'||!/^[\w-]{1,128}$/.test(row.id)||seen.has(row.id))throw Error('Invalid or duplicate record ID.');seen.add(row.id);if(Buffer.byteLength(JSON.stringify(row))>500000)throw Error('Backup record too large.');}}
 const ids=new Set(t.employees.map((e:Row)=>e.id));
 if(t.employees.some((e:Row)=>typeof e.name!=='string'||!e.name.trim()||e.name.length>80||!validHash(e.hash)))throw Error('Invalid employee data.');
 const grouped=new Map<string,Row[]>();
 for(const s of t.shifts){if(!ids.has(s.employee)||!Number.isSafeInteger(s.start)||s.start<=0||(s.end!==null&&(!Number.isSafeInteger(s.end)||s.end<=s.start)))throw Error('Invalid shift.');const group=grouped.get(s.employee)??[];group.push(s);grouped.set(s.employee,group);}
 for(const group of grouped.values()){group.sort((a,b)=>a.start-b.start);for(let i=1;i<group.length;i++)if((group[i-1].end??Infinity)>group[i].start)throw Error('Backup contains overlapping shifts.');}
 const rates=new Set();for(const r of t.payRates){const key=r.employee+':'+r.effective;if(!ids.has(r.employee)||!['salary','hourly'].includes(r.type)||!Number.isSafeInteger(r.cents)||r.cents<0||!/^\d{4}-\d{2}-(01|16)$/.test(r.effective)||rates.has(key))throw Error('Invalid pay rates.');rates.add(key);}
 for(const r of t.payRates)payPeriod(r.effective);
 for(const a of t.audit)if(!Number.isSafeInteger(a.at)||a.at<=0||typeof a.action!=='string'||typeof a.employee!=='string'||typeof a.reason!=='string'||a.reason.length>500||![a.before,a.after].every(v=>v===null||v===undefined||typeof v==='string'))throw Error('Invalid audit record.');
 // Sanitize fields so unexpected uploaded fields cannot affect application state.
 return {hash,employees:t.employees.map((e:Row)=>({id:e.id,name:e.name,hash:e.hash})),shifts:t.shifts.map((s:Row)=>({id:s.id,employee:s.employee,start:s.start,end:s.end})),payRates:t.payRates.map((r:Row)=>({id:r.id,employee:r.employee,effective:r.effective,type:r.type,cents:r.cents})),audit:t.audit.map((a:Row)=>({id:a.id,at:a.at,action:a.action,employee:a.employee,reason:a.reason,before:a.before??null,after:a.after??null}))};
}
export async function restorePayload(payload:any,expected:State){
 const data=validateBackup(payload,expected.storeId),generation=crypto.randomUUID(),writer=firestore().bulkWriter();
 const writes=TABLES.flatMap(table=>data[table].map(row=>writer.set(generationCollection(expected.storeId,generation,table).doc(row.id),row)));
 await Promise.all([...writes,writer.close()]);
 // Switch only after the entire replacement exists. Concurrent edits abort restore.
 await firestore().runTransaction(async tx=>{const latest=await tx.get(root(expected.storeId));if((latest.data()?.revision??0)!==expected.revision)throw Error('Store data changed during restore. Refresh and try again.');tx.set(root(expected.storeId),{hash:data.hash,generation,revision:expected.revision+1},{merge:true});});
 return {restoredAt:new Date().toISOString()};
}
