"use client";
import {useEffect,useState} from 'react';
import {apiFetch} from '../lib/firebase-client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function TabletAccess({pin}:{pin:string}){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function call(body:any){const r=await apiFetch('/api/clock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,pin})});const d:any=await r.json();if(!r.ok)throw Error(d.error);return d;}
 useEffect(()=>{call({action:'get_kiosk'}).then(d=>setEmail(d.email)).catch(e=>setError(e.message));},[pin]);
 async function save(value:string){setBusy(true);setError('');setMessage('');try{await call({action:'set_kiosk',email:value});setEmail(value);setMessage(value?'Store account enabled. Sign in with this account on the tablet.':'Store tablet access disabled.');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel"><h2>Tablet access</h2><p>Create a separate store email/password account in Firebase Authentication, then enable it here. Employees use their PINs on that tablet; manager controls and payroll stay restricted to your manager account.</p>{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}<form onSubmit={e=>{e.preventDefault();save(email.trim().toLowerCase());}}><label htmlFor="tablet-email">Store account email</label><Input id="tablet-email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/><div className="form-actions"><Button type="submit" disabled={busy}>Enable store account</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{if(window.confirm('Disable store tablet access? Existing shifts will be preserved.'))save('');}}>Disable access</Button></div></form><p>On the tablet, sign in with the separate store account and confirm “Employee clock only” appears. No ChatGPT account is needed. Configure managed Android kiosk mode on the device and keep the exit password private.</p></section>;
}
