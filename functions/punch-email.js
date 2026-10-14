const {createHash}=require('node:crypto');
const {deliverOnce}=require('./payroll-email');
const validEmail=value=>typeof value==='string'&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
async function enabledAccount(auth,uid){
 if(!uid)return null;
 try{const u=await auth.getUser(uid);return !u.disabled&&u.emailVerified&&validEmail(u.email)?{uid,email:u.email.toLowerCase()}:null;}
 catch(e){if(e.code==='auth/user-not-found')return null;throw e;}
}
function validEvent(e,storeId){return e?.version===1&&e.storeId===storeId&&['in','out'].includes(e.action)&&typeof e.employeeId==='string'&&typeof e.employeeName==='string'&&typeof e.storeName==='string'&&Number.isSafeInteger(e.at)&&Number.isSafeInteger(e.start)&&e.start>0&&(e.action==='in'?e.end===null&&e.at===e.start:Number.isSafeInteger(e.end)&&e.end>e.start&&e.at===e.end);}
function message(e){
 const format=n=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(n));
 const action=e.action==='in'?'Clock-in':'Clock-out';
 return {subject:`${e.storeName} | ${e.employeeName} | ${action} confirmation`,text:`${e.employeeName} successfully clocked ${e.action==='in'?'in':'out'} at ${e.storeName}.\n\n${action}: ${format(e.at)}\n${e.action==='out'?`Clock-in: ${format(e.start)}\nCompleted shift: ${((e.end-e.start)/3600000).toFixed(2)} hours\n`:''}\nThis confirms the recorded punch. Later manager corrections are not included. If this looks incorrect, contact your store manager.`};
}
async function stillAssigned({db,event,storeId,uid,ownerUid}){
 const root=db.doc('stores/'+storeId),meta=(await root.get()).data();if(!meta)return false;
 if(uid===event.managerUid&&uid===(meta.managerUid||(storeId==='main'?ownerUid:null)))return true;
 if(uid===event.employeeUid){
  const link=(await root.collection('employeeAccess').doc(event.employeeId).get()).data();
  const claim=(await db.doc('storeAccounts/'+uid).get()).data();
  const employee=(await root.collection('generations').doc(meta.generation??'initial').collection('employees').doc(event.employeeId).get()).data();
  return link?.uid===uid&&claim?.role==='employee'&&claim.stores?.[storeId]===event.employeeId&&!!employee&&!employee.archivedAt;
 }
 return false;
}
async function runPunchEmail({db,auth,ownerUid,transport,storeId,eventId}){
 const ref=db.doc(`stores/${storeId}/punchEmails/${eventId}`),event=(await ref.get()).data();
 if(!validEvent(event,storeId))throw Error('Invalid punch email event.');
 const sender=await enabledAccount(auth,ownerUid);if(!sender)throw Error('Enabled verified sender email required.');
 const failures=[],seen=new Set();let needsReview=false,sentOrHandled=0;
 for(const uid of [event.employeeUid,event.managerUid]){
  if(!uid||seen.has(uid))continue;seen.add(uid);
  try{
   const recipient=await enabledAccount(auth,uid);
   if(!recipient||!await stillAssigned({db,event,storeId,uid,ownerUid}))continue;
   await deliverOnce(db,ref,recipient,async()=>{
    const current=await enabledAccount(auth,uid);
    if(!current||current.email!==recipient.email||!await stillAssigned({db,event,storeId,uid,ownerUid}))return null;
    return transport.sendMail({from:{name:'Store Time Clock',address:sender.email},to:recipient.email,...message(event),disableFileAccess:true,disableUrlAccess:true});
   });
   sentOrHandled++;
  }catch{
   const recipient=await enabledAccount(auth,uid);
   const key=recipient?createHash('sha256').update(uid+':'+recipient.email).digest('hex'):null;
   const status=key?(await ref.collection('deliveries').doc(key).get()).data()?.status:null;
   if(status==='needs_review'||status==='sending')needsReview=true;else failures.push(uid);
  }
 }
 if(failures.length)throw Error('Punch email delivery needs review or retry.');
 await ref.set({processedAt:Date.now(),recipientCount:sentOrHandled,status:needsReview?'needs_review':'processed'},{merge:true});
}
async function runPendingPunchEmails(options){
 const stores=await options.db.collection('stores').get();const failures=[];
 for(const store of stores.docs){
  const pending=await store.ref.collection('punchEmails').where('processedAt','==',null).limit(20).get();
  for(const event of pending.docs){try{await runPunchEmail({...options,storeId:store.id,eventId:event.id});}
   catch{failures.push(store.id+':'+event.id);}
  }
 }
 if(failures.length)throw Error('Some pending punch emails could not be processed.');
}
module.exports={runPunchEmail,runPendingPunchEmails,message,validEvent,stillAssigned};
