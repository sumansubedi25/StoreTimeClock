"use client";
import {useEffect,useState,useCallback} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {firebaseAuth,apiFetch} from '../lib/firebase-client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import Clock from './clock';
import EmployeeDashboard from './employee-dashboard';
import {StoreProvider} from './store-context';
import StoreAdmin,{type StoreChoice} from './store-admin';
const IDLE_TIMEOUT_MS=2*60*1000;
const activityKey=(uid:string)=>'timeclock:last-activity:'+uid;
export default function FirebaseLogin(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[stores,setStores]=useState<StoreChoice[]>([]),[storeId,setStoreId]=useState(''),[owner,setOwner]=useState(false),[manage,setManage]=useState(false),[checked,setChecked]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [idleMessage,setIdleMessage]=useState('');
 const refresh=useCallback(async()=>{
  const expected=firebaseAuth().currentUser?.uid;
  const r=await apiFetch('/api/stores'),d:any=await r.json();
  if(!r.ok)throw Error(d.error);
  if(expected!==firebaseAuth().currentUser?.uid)return;
  setStores(d.stores);setOwner(d.owner);setChecked(true);
  setStoreId(current=>d.stores.some((s:StoreChoice)=>s.id===current)?current:(d.stores[0]?.id??''));
 },[]);
 useEffect(()=>onAuthStateChanged(firebaseAuth(),u=>{
  setUser(u);setReady(true);setStores([]);setStoreId('');setOwner(false);setManage(false);setChecked(false);setError('');
  if(u)refresh().catch(e=>{if(firebaseAuth().currentUser?.uid===u.uid){setError(e.message);setChecked(true);}});
 }),[refresh]);
 const current=stores.find(s=>s.id===storeId);
 useEffect(()=>{
  if(!user||current?.role==='kiosk')return;
  const key=activityKey(user.uid);
  let lastActivity=Date.now(),expired=false;
  try{const saved=Number(localStorage.getItem(key));if(saved>0&&saved<=lastActivity)lastActivity=saved;else localStorage.setItem(key,String(lastActivity));}catch{}
  function expire(){
   if(expired)return;expired=true;
   setIdleMessage('Signed out after 2 minutes of inactivity. Sign in to continue.');
   setPassword('');setManage(false);setUser(null);
   void signOut(firebaseAuth()).catch(()=>setError('Please sign in again to continue.'));
  }
  function check(){if(Date.now()-lastActivity>=IDLE_TIMEOUT_MS)expire();}
  function activity(event:Event){
   if(!event.isTrusted||document.visibilityState!=='visible'||expired)return;
   check();if(expired)return;
   lastActivity=Date.now();
   try{localStorage.setItem(key,String(lastActivity));}catch{}
  }
  function resume(){if(document.visibilityState==='visible')check();}
  const events=['pointerdown','pointermove','keydown','scroll','touchstart'];
  events.forEach(name=>window.addEventListener(name,activity,{passive:true,capture:true}));
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('pageshow',check);
  const timer=setInterval(check,1000);check();
  return()=>{clearInterval(timer);events.forEach(name=>window.removeEventListener(name,activity,true));document.removeEventListener('visibilitychange',resume);window.removeEventListener('pageshow',check);};
 },[user?.uid,current?.role]);
 const kingMarket=current?.name.trim().replace(/\s+/g,' ').toLowerCase()==='king market #2 food store';
 async function login(){setBusy(true);setError('');try{const result=await signInWithEmailAndPassword(firebaseAuth(),email.trim(),password);try{localStorage.setItem(activityKey(result.user.uid),String(Date.now()));}catch{}setIdleMessage('');setPassword('');}catch{setError('Unable to sign in. Check your app email and password.');}finally{setBusy(false);}}
 if(!ready)return <main><section className="panel">Loading…</section></main>;
 return <>{user && !manage && (current?.id === 'main' || kingMarket) && <div className={kingMarket?'store-watermark king-market-watermark':'store-watermark'} aria-hidden="true"/>}{user?<><div className="session-bar"><span>{owner?'Owner':current?.role==='kiosk'?'Store tablet':current?.role==='employee'?'Employee':'Manager'} · {user.email}</span>{stores.length>1&&<><label htmlFor="active-store">Store</label><select id="active-store" value={storeId} onChange={e=>{setStoreId(e.target.value);setManage(false);}}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></>}{stores.length===1&&<b>{stores[0].name}</b>}{owner&&<Button variant="outline" onClick={()=>setManage(!manage)}>{manage?'Back to clock':'Manage stores'}</Button>}<Button variant="outline" onClick={()=>signOut(firebaseAuth())}>Sign out</Button></div>{error&&<main><p className="notice error" role="alert">{error}</p><Button onClick={()=>{setError('');refresh().catch(e=>setError(e.message));}}>Retry access</Button></main>}{manage&&owner?<StoreAdmin stores={stores} onSaved={refresh}/>:current?<StoreProvider key={user.uid+':'+current.id} id={current.id}>{current.role==='employee'?<EmployeeDashboard storeId={current.id}/>:<Clock kiosk={current.role==='kiosk'}/>} </StoreProvider>:<main><section className="panel"><p>{checked?'No store is assigned to this account. Ask the owner to assign your manager email or your manager to enable your tablet email.':'Checking store access…'}</p></section></main>}</>:<main><section className="panel setup"><h1>Store Time Clock</h1><p>Sign in with your employee, manager, or store tablet account.</p>{idleMessage&&<p className="notice" role="status">{idleMessage}</p>}{error&&<p className="notice error" role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();login();}}><label htmlFor="login-email">Email</label><Input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/><label htmlFor="login-password">App password</label><Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><Button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></form></section></main>}</>;
}
