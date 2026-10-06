"use client";
import {useEffect,useState} from 'react';
import {sendEmailVerification} from 'firebase/auth';
import {apiFetch,firebaseAuth} from '../lib/firebase-client';
import {useStoreApi} from './store-context';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export function RequestEmployeeAccess({onRefresh}:{onRefresh:()=>Promise<void>}){
 const [name,setName]=useState(''),[code,setCode]=useState(''),[requests,setRequests]=useState<any[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){const r=await apiFetch('/api/access-requests'),d:any=await r.json();if(!r.ok)throw Error(d.error);setRequests(d.requests);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function run(action:string){setBusy(true);setError('');setMessage('');try{
  const user=firebaseAuth().currentUser;if(!user)throw Error('Sign in to continue.');
  if(action==='verify'){await sendEmailVerification(user);setMessage('Verification email sent. Open its link, then return here and select Refresh access.');}
  else {await user.reload();await user.getIdToken(true);if(action==='submit'){const r=await apiFetch('/api/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit',name,storeId:code.trim()})}),d:any=await r.json();if(!r.ok)throw Error(d.error);setMessage('Request sent. Your manager must approve it before you can clock in.');}await load();await onRefresh();}
 }catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel"><h2>Request employee access</h2><p>Verify your email, then enter the store code from your manager. Request each store separately if you work at more than one.</p>{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}<Button variant="outline" disabled={busy} onClick={()=>run('verify')}>Send verification email</Button><Button variant="outline" disabled={busy} onClick={()=>run('refresh')}>Refresh access</Button><form onSubmit={e=>{e.preventDefault();run('submit');}}><label htmlFor="request-name">Your name</label><Input id="request-name" maxLength={80} required value={name} onChange={e=>setName(e.target.value)}/><label htmlFor="request-code">Store code</label><Input id="request-code" required value={code} onChange={e=>setCode(e.target.value)}/><Button disabled={busy} type="submit">Request access</Button></form>{requests.map(r=><p key={r.storeId}><b>{r.storeName}</b> · {r.status}</p>)}</section>;
}
export function ManagerAccessRequests({pin,onSaved}:{pin:string;onSaved:()=>Promise<void>}){
 const api=useStoreApi(),[data,setData]=useState<any>(null),[choices,setChoices]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function request(body:any){const r=await api('/api/access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,pin})}),d:any=await r.json();if(!r.ok)throw Error(d.error);return d;}
 async function load(){setData(await request({action:'list'}));}
 useEffect(()=>{load().catch(e=>setError(e.message));},[api,pin]);
 async function resolve(uid:string,action:string){if(!window.confirm(action==='approve'?'Approve this employee’s access to this store?':'Reject this access request?'))return;setBusy(true);setError('');try{await request({action,uid,employee:choices[uid]??''});await load();await onSaved();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel"><h2>Employee access requests</h2>{error&&<p className="notice error" role="alert">{error}</p>}{data&&<><p>Share this store code with your employees: <b>{data.storeId}</b></p><p>Employees create their own login and verify their email. Link an existing employee to keep their hours and pay history. For a new employee, set their pay rate in Management tools after approval.</p><Button variant="outline" disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>Refresh requests</Button>{!data.requests.length&&<p>No pending requests.</p>}{data.requests.map((r:any)=><div className="access-request" key={r.uid}><h3>{r.name}</h3><p>{r.email}</p><label htmlFor={'request-employee-'+r.uid}>Employee record</label><select id={'request-employee-'+r.uid} value={choices[r.uid]??''} disabled={busy} onChange={e=>setChoices({...choices,[r.uid]:e.target.value})}><option value="">Create new employee</option>{data.employees.filter((e:any)=>!e.linked).map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}</select><Button disabled={busy} onClick={()=>resolve(r.uid,'approve')}>Approve</Button><Button variant="outline" disabled={busy} onClick={()=>resolve(r.uid,'reject')}>Reject</Button></div>)}</>}</section>;
}
