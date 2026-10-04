"use client";
import {useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {firebaseAuth,apiFetch} from '../lib/firebase-client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import Clock from './clock';
export default function FirebaseLogin(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[role,setRole]=useState<string|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>onAuthStateChanged(firebaseAuth(),u=>{setUser(u);setReady(true);setRole(null);setError('');if(u)apiFetch('/api/clock').then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);setRole(d.kiosk?'kiosk':'manager');}).catch(e=>setError(e.message));}),[]);
 async function login(){setBusy(true);setError('');try{await signInWithEmailAndPassword(firebaseAuth(),email.trim(),password);setPassword('');}catch{setError('Unable to sign in. Check your app email and password.');}finally{setBusy(false);}}
 if(!ready)return <main><section className="panel">Loading…</section></main>;
 return <>{user?<><div className="session-bar"><span>{role==='kiosk'?'Store tablet':'Manager'} · {user.email}</span><Button variant="outline" onClick={()=>signOut(firebaseAuth())}>Sign out</Button></div>{role?<Clock key={user.uid} kiosk={role==='kiosk'}/>:<main><section className="panel"><p role="alert">{error||'Checking store access…'}</p></section></main>}</>:<main><section className="panel setup"><h1>Store Time Clock</h1><p>Sign in with your manager or store tablet account.</p>{error&&<p className="notice error" role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();login();}}><label htmlFor="login-email">Email</label><Input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/><label htmlFor="login-password">App password</label><Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><Button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></form></section></main>}</>;
}
