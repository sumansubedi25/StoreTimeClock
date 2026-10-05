const TABLES=['employees','shifts','payRates','audit'];
function dayEnded(scheduleTime){
  // Midnight belongs to the new day; label the snapshot with the day just ended.
  const instant=new Date(new Date(scheduleTime).getTime()-1);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(instant).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
async function runDailyBackups(db,scheduleTime){
  const day=dayEnded(scheduleTime),stores=await db.collection('stores').get();
  const failed=[];
  for(const store of stores.docs){
    try{
      const root=db.doc('stores/'+store.id),ref=root.collection('backups').doc('daily-'+day);
      if((await ref.get()).data()?.complete)continue;
      const payload=await db.runTransaction(async tx=>{
        const doc=await tx.get(root),meta=doc.data();
        if(!meta?.hash)return null;
        const gen=root.collection('generations').doc(meta.generation??'initial');
        const snapshots=await Promise.all(TABLES.map(t=>tx.get(gen.collection(t))));
        const tables=Object.fromEntries(TABLES.map((t,i)=>[t,snapshots[i].docs.map(d=>({...d.data(),id:d.id}))]));
        return {format:'store-time-clock-backup',version:1,storeId:store.id,
          storeName:meta.name??'Store',owner:'firebase-'+store.id,createdAt:new Date().toISOString(),
          tables:{...tables,settings:[{hash:meta.hash}],kioskAccess:meta.kioskEmail?[{email:meta.kioskEmail}]:[]}};
      },{readOnly:true});
      if(!payload)continue;
      const body=JSON.stringify(payload),chunks=body.match(/[\s\S]{1,60000}/g)??[];
      // Clean incomplete attempts before retrying; completed days are never overwritten.
      await db.recursiveDelete(ref);
      const writer=db.bulkWriter();
      await Promise.all([...chunks.map((text,i)=>writer.set(ref.collection('chunks').doc(String(i).padStart(8,'0')),{text})),writer.close()]);
      await ref.set({uploaded:payload.createdAt,size:Buffer.byteLength(body),kind:'daily',day,chunks:chunks.length,complete:true});
    }catch(error){console.error('Daily backup failed for store',store.id,error);failed.push(store.id);}
  }
  if(failed.length)throw Error('Daily backups failed for '+failed.join(', '));
}
module.exports={runDailyBackups,dayEnded};
