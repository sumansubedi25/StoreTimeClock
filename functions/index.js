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
