import {pbkdf2Sync,timingSafeEqual,randomUUID} from 'node:crypto';
import {calculatePay,payPeriod,rateCents} from './payroll';
import {shiftError} from './shift-validation';
import {locationError} from './geofence';
import type {Row,State} from './firebase-store';
import {storeSettings} from './store-policy';
export class ClockError extends Error{constructor(message:string,public status=400){super(message);}}
export function fail(message:string,status=400):never{throw new ClockError(message,status);}
export const validPin=(pin:unknown)=>typeof pin==='string'&&/^\d{6,12}$/.test(pin);
export function hashPin(pin:string,salt:string=randomUUID()){return salt+':'+pbkdf2Sync(pin,salt,100000,32,'sha256').toString('hex');}
export function verifyPin(pin:unknown,expected:string){if(!validPin(pin))return false;const actual=Buffer.from(hashPin(pin as string,expected.split(':')[0]));const target=Buffer.from(expected);return actual.length===target.length&&timingSafeEqual(actual,target);}
export function clockStatus(s:State,kiosk:boolean){return {setup:!!s.hash,kiosk,store:{id:s.storeId,name:s.name,location:s.location,geofenceEnabled:s.geofenceEnabled},employees:s.employees.map(e=>({id:e.id,name:e.name,start:s.shifts.find(x=>x.employee===e.id&&x.end===null)?.start??null})).sort((a,b)=>a.name.localeCompare(b.name))};}
export function audit(s:State,action:string,employee:string,reason:string,before:any,after:any){s.audit.push({id:randomUUID(),at:Date.now(),action,employee,reason,before:before?JSON.stringify(before):null,after:after?JSON.stringify(after):null});}
export function payroll(s:State,p:Row){
 const period=payPeriod(p.period);
 const rows=s.employees.map(e=>{const rate=s.payRates.filter(r=>r.employee===e.id&&r.effective<=p.period).sort((a,b)=>b.effective.localeCompare(a.effective))[0];const relevant=s.shifts.filter(x=>x.employee===e.id&&x.start<period.end&&(x.end===null||x.end>period.start));const ms=relevant.reduce((n,x)=>n+(x.end===null?0:Math.max(0,Math.min(x.end,period.end)-Math.max(x.start,period.start))),0);return {id:e.id,name:e.name,type:rate?.type??null,cents:rate?.cents??null,effective:rate?.effective??null,hours:ms/3600000,active:relevant.filter(x=>x.end===null).length,payCents:calculatePay(rate?.type??null,rate?.cents??null,ms)};}).sort((a,b)=>a.name.localeCompare(b.name));
 return {period,rows,totalCents:rows.reduce((n,e)=>n+(e.payCents??0),0),unconfigured:rows.filter(e=>e.payCents===null).length};
}
export function applyAction(s:State,p:Row,now=Date.now()){
 if(p.action==='setup'){if(s.hash)fail('Already set up.',409);if(!validPin(p.pin))fail('Use a PIN with 6–12 digits.');s.hash=hashPin(p.pin);return {ok:true};}
 if(p.action==='report')return {shifts:s.shifts.map(x=>({...x,name:s.employees.find(e=>e.id===x.employee)?.name??'Unknown'})).sort((a:Row,b:Row)=>b.start-a.start),audit:[...s.audit].sort((a,b)=>b.at-a.at).slice(0,100)};
 if(p.action==='payroll')return payroll(s,p);
 if(p.action==='get_kiosk')return {email:s.kioskEmail};
 if(p.action==='get_store')return {name:s.name,location:s.location,geofenceEnabled:s.geofenceEnabled};
 if(p.action==='set_store'){const settings=storeSettings(p);audit(s,p.action,s.name,'Store name, location, or geolocking updated',{name:s.name,location:s.location,geofenceEnabled:s.geofenceEnabled},settings);Object.assign(s,settings);return {ok:true};}
 if(p.action==='set_kiosk'){const email=String(p.email??'').trim().toLowerCase();if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))fail('Enter a valid separate store email.');audit(s,p.action,'Store tablet','Tablet access updated',{email:s.kioskEmail},{email});s.kioskEmail=email;s.kioskUid=p.kioskUid??'';return {ok:true};}
 if(p.action==='add'){const name=String(p.name??'').trim();if(!name||name.length>80||!validPin(p.employeePin))fail('Enter a name and a 6–12 digit employee PIN.');s.employees.push({id:randomUUID(),name,hash:hashPin(p.employeePin)});return {ok:true};}
 const employee=s.employees.find(e=>e.id===p.employee);if(!employee)fail('Employee not found.',404);
 const group=s.shifts.filter(x=>x.employee===employee.id);
 if(p.action==='in'){if(s.geofenceEnabled!==false){const problem=locationError(p.location,now,s.location);if(problem)fail(problem,403);}if(group.some(x=>x.end===null))fail('Already clocked in.',409);if(group.some(x=>x.end>now))fail('A shift overlaps this clock-in.',409);s.shifts.push({id:randomUUID(),employee:employee.id,start:now,end:null});return {ok:true};}
 if(p.action==='out'){const open=group.find(x=>x.end===null);if(!open)fail('Not currently clocked in.',409);if(now<=open.start)fail('Clock-out must be later than clock-in.');open.end=now;return {ok:true};}
 const reason=typeof p.reason==='string'?p.reason.trim():'';if(!reason||reason.length>500)fail('Enter a reason for this change (up to 500 characters).');
 if(p.action==='set_pay'){payPeriod(p.period);const cents=rateCents(p.rate);if(!['hourly','salary'].includes(p.type))fail('Choose hourly or salary.');const before=s.payRates.filter(r=>r.employee===employee.id&&r.effective<=p.period).sort((a,b)=>b.effective.localeCompare(a.effective))[0];const rate=s.payRates.find(r=>r.employee===employee.id&&r.effective===p.period);const after={id:rate?.id??randomUUID(),employee:employee.id,effective:p.period,type:p.type,cents};audit(s,p.action,employee.name,reason,before,after);if(rate)Object.assign(rate,after);else s.payRates.push(after);return {ok:true};}
 if(p.action==='edit_employee'){const name=typeof p.name==='string'?p.name.trim():'';if(!name||name.length>80||(p.employeePin&&!validPin(p.employeePin)))fail('Enter a name and, if changing it, a 6–12 digit PIN.');audit(s,p.action,employee.name,reason,{name:employee.name},{name,pinChanged:!!p.employeePin});employee.name=name;if(p.employeePin)employee.hash=hashPin(p.employeePin);return {ok:true};}
 const before=p.shift?group.find(x=>x.id===p.shift):null;if(p.shift&&!before)fail('Shift not found.',404);if(before&&(before.start!==p.originalStart||before.end!==p.originalEnd))fail('This shift changed since you opened it. Refresh and try again.',409);
 if(p.action==='delete_shift'){if(!before)fail('Choose a shift to delete.');audit(s,p.action,employee.name,reason,before,null);s.shifts=s.shifts.filter(x=>x.id!==before.id);return {ok:true};}
 if(p.action==='save_shift'){const problem=shiftError(p.start,p.end,now);if(problem)fail(problem);if(group.some(x=>x.id!==before?.id&&x.start<(p.end??Infinity)&&(x.end??Infinity)>p.start))fail('This time overlaps another shift for this employee.',409);const after={id:before?.id??randomUUID(),employee:employee.id,start:p.start,end:p.end};audit(s,p.action,employee.name,reason,before,after);if(before)Object.assign(before,after);else s.shifts.push(after);return {ok:true};}
 fail('Unknown action.');
}
