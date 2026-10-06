const {createHash}=require('node:crypto');
const {lastClosedPeriod,buildReport,reportPdf}=require('./payroll-report');
const validEmail=value=>typeof value==='string'&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
async function account(auth,uid){if(!uid)return null;try{const user=await auth.getUser(uid);return !user.disabled&&validEmail(user.email)?{uid,email:user.email.toLowerCase()}:null;}catch(e){if(e.code==='auth/user-not-found')return null;throw e;}}
async function recipientsFor(auth,meta,storeId,ownerUid){const owner=await account(auth,ownerUid);if(!owner)throw Error('Owner account requires an enabled login and valid email.');const manager=await account(auth,meta.managerUid||(storeId==='main'?ownerUid:''));return {owner,manager,recipients:manager&&manager.email!==owner.email?[owner,manager]:[owner]};}
async function snapshotReport(db,storeId,period){const root=db.doc('stores/'+storeId),ref=root.collection('payrollReports').doc(period.startDate);return db.runTransaction(async tx=>{
 const existing=await tx.get(ref);if(existing.data()?.report)return existing.data().report;
 const doc=await tx.get(root),meta=doc.data();if(!meta?.hash)return null;
 const gen=root.collection('generations').doc(meta.generation??'initial');const names=['employees','shifts','payRates'];const snapshots=await Promise.all(names.map(n=>tx.get(gen.collection(n))));
 const state={storeId,name:meta.name??'Store',...Object.fromEntries(names.map((n,i)=>[n,snapshots[i].docs.map(d=>({...d.data(),id:d.id}))]))};
 const report=buildReport(state,period);if(Buffer.byteLength(JSON.stringify(report))>800000)throw Error('Report exceeds snapshot size limit; split report before emailing.');
 tx.set(ref,{report,createdAt:report.generatedAt});return report;
 });}
async function deliverOnce(db,ref,recipient,send){const key=createHash('sha256').update(recipient.uid+':'+recipient.email).digest('hex'),delivery=ref.collection('deliveries').doc(key);
 const claim=await db.runTransaction(async tx=>{const old=await tx.get(delivery),status=old.data()?.status;if(status==='sent')return false;if(status==='sending'||status==='needs_review')throw Error('Prior email delivery needs review before resending.');tx.set(delivery,{uid:recipient.uid,email:recipient.email,status:'sending',startedAt:new Date().toISOString()});return true;});
 if(!claim)return;
 try{const result=await send();if(result===null){await delivery.set({status:'cancelled',reason:'Recipient assignment changed'},{merge:true});return;}if(!result.accepted?.some(e=>(typeof e==='string'?e:e.address)?.toLowerCase()===recipient.email))throw Error('SMTP did not accept this recipient');await delivery.set({status:'sent',sentAt:new Date().toISOString(),messageId:result.messageId??''},{merge:true});}
 catch(error){await delivery.set({status:'needs_review',failedAt:new Date().toISOString(),errorCode:typeof error.code==='string'?error.code:'DELIVERY_UNCERTAIN'},{merge:true});throw Error('Email delivery failed or is uncertain; inspect payrollReports delivery status before retrying.');}
}
async function runPayrollEmails({db,auth,ownerUid,transport,scheduleTime,makePdf=reportPdf}){
 const period=lastClosedPeriod(scheduleTime),stores=await db.collection('stores').get(),failures=[];
 for(const store of stores.docs){try{
  const root=db.doc('stores/'+store.id),meta=(await root.get()).data();if(!meta?.hash)continue;
  const {owner,manager,recipients}=await recipientsFor(auth,meta,store.id,ownerUid);
  const report=await snapshotReport(db,store.id,period);if(!report)continue;
  const pdf=await makePdf(report),ref=root.collection('payrollReports').doc(period.startDate);
  for(const recipient of recipients){try{await deliverOnce(db,ref,recipient,async()=>{
   const latest=(await root.get()).data(),current=await account(auth,recipient.uid);if(!current||current.email!==recipient.email)return null;
   if(recipient.uid!==ownerUid&&recipient.uid!==(latest?.managerUid||(store.id==='main'?ownerUid:'')))return null;
   const warning=report.open||report.unconfigured?' Review required: open shifts or missing pay rates are listed in the PDF.':'';
   return transport.sendMail({from:{name:'Store Time Clock',address:owner.email},to:recipient.email,subject:`${report.storeName} | Payroll ${period.startDate} to ${period.endDate}`,text:`Attached is the payroll report for ${report.storeName}, ${period.startDate} through ${period.endDate}.\n\nCompleted hours: ${report.totalHours.toFixed(2)}\nEstimated gross pay: $${(report.totalCents/100).toFixed(2)}\nCompleted shifts: ${report.completed}\n${warning}\n${!manager?'No enabled manager email was found; this report is sent to the owner only.':''}\nThis is a snapshot. Later corrections are not included.`,attachments:[{filename:`payroll-${store.id}-${period.startDate}.pdf`,content:pdf,contentType:'application/pdf'}],disableFileAccess:true,disableUrlAccess:true});
  });}catch{console.error('Payroll email delivery needs attention',{storeId:store.id,period:period.startDate,recipientUid:recipient.uid});failures.push(store.id+':'+recipient.uid);}}
 }catch{console.error('Payroll report failed',{storeId:store.id,period:period.startDate});failures.push(store.id);}}
 if(failures.length)throw Error('Payroll email jobs need attention: '+failures.join(', '));
}
module.exports={recipientsFor,snapshotReport,deliverOnce,runPayrollEmails};
