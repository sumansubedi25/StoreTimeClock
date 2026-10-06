const PDFDocument=require('pdfkit');
const ZONE='America/Chicago';
const parts=at=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));
function midnight(date){for(const h of [5,6]){const t=Date.parse(date+'T00:00:00Z')+h*3600000;const d=parts(t);const hour=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'2-digit',hourCycle:'h23'}).format(new Date(t));if(`${d.year}-${d.month}-${d.day}`===date&&hour==='00')return t;}throw Error('Invalid Central date');}
function lastClosedPeriod(at){const d=parts(at);let startDate,endDate;
 if(Number(d.day)>=16){startDate=`${d.year}-${d.month}-01`;endDate=`${d.year}-${d.month}-16`;}
 else{endDate=`${d.year}-${d.month}-01`;const previous=new Date(Date.parse(endDate+'T12:00:00Z')-86400000);startDate=previous.toISOString().slice(0,7)+'-16';}
 return {startDate,endDate:new Date(Date.parse(endDate+'T12:00:00Z')-86400000).toISOString().slice(0,10),start:midnight(startDate),end:midnight(endDate)};
}
function buildReport(state,period,generatedAt=new Date().toISOString()){
 const relevant=state.shifts.filter(s=>s.start<period.end&&(s.end===null||s.end>period.start));
 const employees=state.employees.filter(e=>!e.archivedAt||e.archivedAt>=period.start||relevant.some(s=>s.employee===e.id));
 const shifts=relevant.map(s=>({id:s.id,employee:s.employee,name:state.employees.find(e=>e.id===s.employee)?.name??'Unknown employee',start:s.start,end:s.end,hours:s.end===null?0:Math.max(0,Math.min(s.end,period.end)-Math.max(s.start,period.start))/3600000})).sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name));
 const rows=employees.map(e=>{const own=shifts.filter(s=>s.employee===e.id),ms=own.reduce((n,s)=>n+(s.end===null?0:Math.max(0,Math.min(s.end,period.end)-Math.max(s.start,period.start))),0),hours=ms/3600000,rate=state.payRates.filter(r=>r.employee===e.id&&r.effective<=period.startDate).sort((a,b)=>b.effective.localeCompare(a.effective))[0];return {id:e.id,name:e.name,archived:!!e.archivedAt,type:rate?.type??null,cents:rate?.cents??null,hours,payCents:!rate?null:rate.type==='salary'?rate.cents:Math.round(rate.cents*ms/3600000),completed:own.filter(s=>s.end!==null).length,open:own.filter(s=>s.end===null).length};}).sort((a,b)=>a.name.localeCompare(b.name));
 return {storeId:state.storeId,storeName:state.name,period,generatedAt,rows,shifts,totalHours:rows.reduce((n,r)=>n+r.hours,0),totalCents:rows.reduce((n,r)=>n+(r.payCents??0),0),completed:shifts.filter(s=>s.end!==null).length,open:shifts.filter(s=>s.end===null).length,unconfigured:rows.filter(r=>r.payCents===null).length};
}
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
const stamp=t=>new Date(t).toLocaleString('en-US',{timeZone:ZONE,weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
function reportPdf(report){return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'LETTER',margin:42,bufferPages:true,info:{Title:report.storeName+' payroll report',Author:'Store Time Clock'}}),chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
 const left=42,width=528,bottom=718;let y;
 function page(title,first=false){if(!first)doc.addPage();doc.rect(0,0,612,112).fill('#14344c');doc.fillColor('#83dbd3').font('Helvetica-Bold').fontSize(9).text('STORE TIME CLOCK  /  PAYROLL REPORT',left,25,{width});doc.fillColor('white').fontSize(19).text(report.storeName,left,44,{width,height:45,ellipsis:true});doc.font('Helvetica').fontSize(10).text(`${report.period.startDate} through ${report.period.endDate}  |  Central Time`,left,92,{width});y=135;doc.fillColor('#14344c').font('Helvetica-Bold').fontSize(16).text(title,left,y,{width});y+=29;}
 function note(text){doc.font('Helvetica').fontSize(9);const h=doc.heightOfString(text,{width});if(y+h>bottom)page('Report notes');doc.fillColor('#526577').text(text,left,y,{width});y+=h+10;}
 function table(headers,widths,rows,title){const header=()=>{doc.rect(left,y,width,27).fill('#e4f0f7');let x=left;doc.font('Helvetica-Bold').fontSize(9).fillColor('#14344c');headers.forEach((h,i)=>{doc.text(h,x+7,y+8,{width:widths[i]-14});x+=widths[i];});y+=27;};header();rows.forEach((row,index)=>{doc.font('Helvetica').fontSize(9);const h=Math.max(30,...row.map((v,i)=>doc.heightOfString(String(v),{width:widths[i]-14})+16));if(y+h>bottom){page(title+' (continued)');header();}if(index%2===0)doc.rect(left,y,width,h).fill('#f5f8fb');let x=left;row.forEach((v,i)=>{doc.fillColor('#18344a').font('Helvetica').fontSize(9).text(String(v),x+7,y+8,{width:widths[i]-14});x+=widths[i];});y+=h;});y+=16;}
 page('Pay period summary',true);
 const metrics=[['COMPLETED HOURS',report.totalHours.toFixed(2)],['GROSS PAY OWED',money(report.totalCents)],['COMPLETED SHIFTS',String(report.completed)]];
 metrics.forEach(([label,value],i)=>{const x=left+i*180;doc.roundedRect(x,y,168,62,6).fill('#eaf4f9');doc.fillColor('#526577').font('Helvetica-Bold').fontSize(8).text(label,x+10,y+11,{width:150});doc.fillColor('#14344c').fontSize(21).text(value,x+10,y+28,{width:150});});y+=82;
 if(report.open||report.unconfigured)note(`REVIEW NEEDED: ${report.open} open shift(s) excluded from hours; ${report.unconfigured} employee(s) without pay rates excluded from pay totals.`);
 table(['Employee','Pay type / rate','Hours','Gross pay','Shifts'],[160,136,66,95,71],report.rows.map(r=>[r.name+(r.archived?' (archived)':''),r.type?`${r.type==='salary'?'Salary / period':'Hourly'}\n${money(r.cents)}`:'NOT SET',r.hours.toFixed(2),r.payCents===null?'NOT SET':money(r.payCents),`${r.completed} closed${r.open?'\n'+r.open+' open':''}`]),'Employee summary');
 if(!report.rows.length)note('No employees to report for this period.');
 note('Gross estimates match the app: completed hours within this pay period times the hourly rate, or the fixed salary per period. Active shifts are excluded. No taxes, deductions, overtime premiums or salary proration are applied.');
 note('Generated '+stamp(Date.parse(report.generatedAt))+'. Later corrections in the app are not included in this emailed snapshot.');
 page('Shift details');note('Clock-in/out timestamps are shown in Central Time. Hours include only the portion inside this pay period. A shift spanning a period boundary may appear in both periods.');
 table(['Employee','Clock in','Clock out','Hours','Status'],[115,145,145,58,65],report.shifts.map(s=>[s.name,stamp(s.start),s.end===null?'Still open':stamp(s.end),s.end===null?'Excluded':s.hours.toFixed(2),s.end===null?'REVIEW':'Closed']),'Shift details');
 if(!report.shifts.length)note('No shifts overlap this pay period.');
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.fillColor('#647789').font('Helvetica').fontSize(8).text(`Confidential payroll report  |  Page ${i+1} of ${range.count}`,left,732,{width,lineBreak:false});}doc.end();
 });}
module.exports={lastClosedPeriod,buildReport,reportPdf};
