export type ClockAccess={owner:string;role:'manager'|'kiosk'};
export async function resolveClockAccess(user:{userId:string;email:string},ownerEmail:string,lookup:(email:string)=>Promise<{owner:string}|null>):Promise<ClockAccess|null>{
const email=user.email.trim().toLowerCase();
if(email===ownerEmail.trim().toLowerCase())return {owner:user.userId,role:'manager'};
const kiosk=await lookup(email);return kiosk?{owner:kiosk.owner,role:'kiosk'}:null;
}
export function canClockAction(access:ClockAccess|null,action:unknown){return !!access&&(access.role==='manager'||action==='in'||action==='out');}
