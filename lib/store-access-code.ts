import {randomInt} from 'node:crypto';
import {firestore} from './firebase-admin';
import {validStoreId} from './store-policy';
export function validAccessCode(value:unknown):value is string{return typeof value==='string'&&/^\d{6}$/.test(value);}
// Codes are stable store identifiers, not passwords. Only manager approval grants access.
export async function ensureStoreAccessCode(storeId:string){
 if(!validStoreId(storeId))throw Error('Invalid store.');
 return firestore().runTransaction(async tx=>{
  const ref=firestore().doc('stores/'+storeId),store=await tx.get(ref);
  if(!store.exists&&storeId!=='main')throw Error('Store not found.');
  const existing=store.data()?.accessCode;
  if(validAccessCode(existing)){
   const registry=await tx.get(firestore().doc('storeAccessCodes/'+existing));
   if(registry.data()?.storeId===storeId)return existing;
   if(!registry.exists){tx.set(firestore().doc('storeAccessCodes/'+existing),{storeId});return existing;}
  }
  for(let tries=0;tries<30;tries++){
   const code=String(randomInt(100000,1000000)),codeRef=firestore().doc('storeAccessCodes/'+code),used=await tx.get(codeRef);
   if(used.exists)continue;
   tx.set(codeRef,{storeId});tx.set(ref,{accessCode:code},{merge:true});return code;
  }
  throw Error('Could not allocate a store code. Try again.');
 });
}
