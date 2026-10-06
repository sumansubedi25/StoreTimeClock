const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {runDailyBackups}=require('./daily-backups');
initializeApp();
exports.dailyStoreBackup=onSchedule({
  schedule:'0 0 * * *', timeZone:'America/Chicago', region:'us-east4',
  timeoutSeconds:540, memory:'512MiB', maxInstances:1, concurrency:1,
  retryCount:3, minBackoffSeconds:60, maxBackoffSeconds:300,
},async event=>{
  await runDailyBackups(getFirestore(),event.scheduleTime);
});

const {getAuth}=require('firebase-admin/auth');
const {defineSecret,defineString}=require('firebase-functions/params');
const nodemailer=require('nodemailer');
const {runPayrollEmails}=require('./payroll-email');
const gmailPassword=defineSecret('PAYROLL_GMAIL_APP_PASSWORD');
const ownerUid=defineString('PAYROLL_OWNER_UID',{default:'CRWIoygqx9fYs2RJlQsBhLiCUT12',description:'Firebase UID of the owner receiving every store report'});
exports.payPeriodPayrollEmail=onSchedule({
 schedule:'0 6 1,16 * *',timeZone:'America/Chicago',region:'us-east4',
 timeoutSeconds:540,memory:'512MiB',maxInstances:1,concurrency:1,
 retryCount:3,minBackoffSeconds:60,maxBackoffSeconds:300,secrets:[gmailPassword],
},async event=>{
 const auth=getAuth(),owner=await auth.getUser(ownerUid.value());
 if(owner.disabled||!owner.email)throw Error('Owner email is not available.');
 const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
  auth:{user:owner.email,pass:gmailPassword.value().replace(/\s/g,'')},connectionTimeout:20000,greetingTimeout:20000,socketTimeout:60000});
 try{await transport.verify();await runPayrollEmails({db:getFirestore(),auth,ownerUid:ownerUid.value(),transport,scheduleTime:event.scheduleTime});}finally{transport.close();}
});
