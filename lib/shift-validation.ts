export function shiftError(start:unknown,end:unknown,now=Date.now()):string|null{
 if(typeof start!=='number'||!Number.isSafeInteger(start)||start<=0)return 'Enter a valid clock-in time.';
 if(end!==null&&(typeof end!=='number'||!Number.isSafeInteger(end)))return 'Enter a valid clock-out time or leave it blank.';
 if(start>now||(typeof end==='number'&&end>now))return 'Shift times cannot be in the future.';
 if(typeof end==='number'&&end<=start)return 'Clock-out must be later than clock-in.';
 return null;
}
