import {database} from '../db/raw';
import {resolveClockAccess} from './access-policy';
// Site owner's verified account email. This module is used only on the server.
export const OWNER_EMAIL='sumansubedi33@gmail.com';
export async function clockAccess(user:{userId:string;email:string}){return resolveClockAccess(user,OWNER_EMAIL,email=>database().prepare('SELECT owner FROM kiosk_access WHERE email=?').bind(email).first<{owner:string}>());}
