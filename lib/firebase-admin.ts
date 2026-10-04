import {applicationDefault,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
function adminApp(){return getApps()[0]??initializeApp({projectId:'store-timeclock',credential:applicationDefault()});}
export function firestore(){return getFirestore(adminApp());}
export function adminAuth(){return getAuth(adminApp());}
export function managerUid(){const uid=process.env.MANAGER_UID;if(!uid||uid==='REPLACE_WITH_MANAGER_UID')throw Error('Set MANAGER_UID before using the time clock.');return uid;}
export async function authenticatedUser(request:Request){
 const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return null;
 try{return await adminAuth().verifyIdToken(bearer.slice(7),true);}catch{return null;}
}
