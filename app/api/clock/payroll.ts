import {database} from '../../../db/raw';
import {payPeriod,rateCents,calculatePay} from '../../../lib/payroll';
import {bestEffortBackup} from '../../../lib/backups';
export async function payrollAction(p:Record<string,any>,owner:string){
const db=database();let period;try{period=payPeriod(p.period);}catch(e:any){return Response.json({error:e.message},{status:400});}
if(p.action==='set_pay'){
let cents;try{cents=rateCents(p.rate);}catch(e:any){return Response.json({error:e.message},{status:400});}
if(!['hourly','salary'].includes(p.type))return Response.json({error:'Choose hourly or salary.'},{status:400});
const reason=typeof p.reason==='string'?p.reason.trim():'';if(!reason||reason.length>500)return Response.json({error:'Enter a reason for the pay setting.'},{status:400});
const employee=await db.prepare('SELECT id,name FROM employees WHERE id=? AND owner=?').bind(String(p.employee||''),owner).first<{id:string,name:string}>();if(!employee)return Response.json({error:'Employee not found.'},{status:404});
const before=await db.prepare('SELECT type,cents,effective FROM pay_rates WHERE employee=? AND effective<=? ORDER BY effective DESC LIMIT 1').bind(employee.id,p.period).first();
await db.batch([db.prepare('INSERT INTO pay_rates(id,employee,effective,type,cents) VALUES (?,?,?,?,?) ON CONFLICT(employee,effective) DO UPDATE SET type=excluded.type,cents=excluded.cents').bind(crypto.randomUUID(),employee.id,p.period,p.type,cents),db.prepare('INSERT INTO audit(id,owner,at,action,employee,reason,before,after) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,Date.now(),'set_pay',employee.name,reason,before?JSON.stringify(before):null,JSON.stringify({type:p.type,cents,effective:p.period}))]);await bestEffortBackup(owner);return Response.json({ok:true});
}
const employees=await db.prepare('SELECT e.id,e.name,r.type,r.cents,r.effective FROM employees e LEFT JOIN pay_rates r ON r.employee=e.id AND r.effective=(SELECT MAX(effective) FROM pay_rates WHERE employee=e.id AND effective<=?) WHERE e.owner=? ORDER BY e.name').bind(p.period,owner).all<any>();
const shifts=await db.prepare('SELECT s.employee,s.start,s.end FROM shifts s JOIN employees e ON e.id=s.employee WHERE e.owner=? AND s.start<? AND (s.end>? OR s.end IS NULL)').bind(owner,period.end,period.start).all<any>();
const rows=employees.results.map(e=>{const relevant=shifts.results.filter(s=>s.employee===e.id);const milliseconds=relevant.reduce((n,s)=>n+(s.end===null?0:Math.max(0,Math.min(s.end,period.end)-Math.max(s.start,period.start))),0);return {...e,hours:milliseconds/3600000,active:relevant.filter(s=>s.end===null).length,payCents:calculatePay(e.type,e.cents,milliseconds)};});
return Response.json({period,rows,totalCents:rows.reduce((n,e)=>n+(e.payCents??0),0),unconfigured:rows.filter(e=>e.payCents===null).length},{headers:{'Cache-Control':'no-store'}});
}
