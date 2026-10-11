/** Store-local greetings follow Central Time, including daylight saving changes. */
export function greetingForTime(date:Date):string {
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(date));
 if(hour>=5&&hour<12)return 'Good morning';
 if(hour>=12&&hour<17)return 'Good afternoon';
 if(hour>=17&&hour<22)return 'Good evening';
 return 'Good night';
}
export function accountGreetingName(name?:string|null,email?:string|null):string {
 const explicit=name?.trim();
 if(explicit)return explicit.split(/\s+/)[0];
 const local=email?.split('@')[0]?.split('+')[0]?.replace(/[._-]+/g,' ').trim();
 if(!local)return '';
 const first=local.split(/\s+/)[0];
 return first.charAt(0).toUpperCase()+first.slice(1);
}
