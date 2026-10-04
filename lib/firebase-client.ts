"use client";
import {getApp,getApps,initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
const config={apiKey:'AIzaSyDJKUvbJi8I8rNKAG0ZhXi27ng1N-wbLi0',authDomain:'store-timeclock.firebaseapp.com',projectId:'store-timeclock',storageBucket:'store-timeclock.firebasestorage.app',messagingSenderId:'803824306082',appId:'1:803824306082:web:a698160c94745049b754fb'};
export function firebaseAuth(){return getAuth(getApps().length?getApp():initializeApp(config));}
export async function apiFetch(url:string,options:RequestInit={}){
 const user=firebaseAuth().currentUser;if(!user)throw Error('Sign in to continue.');
 const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${await user.getIdToken()}`);
 const response=await fetch(url,{...options,headers,cache:'no-store'});
 if(options.method==='POST'&&response.headers.get('Content-Type')?.includes('application/json')){
  const data:any=await response.clone().json().catch(()=>null);
  if(data?.backupWarning)window.alert(data.backupWarning);
 }
 return response;
}
