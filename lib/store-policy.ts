import {STORE_LOCATION,type StoreLocation} from './geofence';
export type StoreMeta={name:string;managerUid:string;managerEmail:string;kioskUid:string;kioskEmail:string;location:StoreLocation|null;geofenceEnabled:boolean};
export type StoreRole='manager'|'kiosk';
export function validStoreId(value:unknown):value is string{return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);}
export function storeMeta(id:string,data:Record<string,any>,ownerUid:string):StoreMeta{
 return {name:data.name??(id==='main'?'Webb Chapel store':'Store'),managerUid:data.managerUid??(id==='main'?ownerUid:''),managerEmail:data.managerEmail??'',kioskUid:data.kioskUid??'',kioskEmail:data.kioskEmail??'',location:data.location??(id==='main'?STORE_LOCATION:null),geofenceEnabled:data.geofenceEnabled!==false};
}
export function storeRole(uid:string,meta:StoreMeta,ownerUid:string):StoreRole|null{
 if(uid===ownerUid||uid===meta.managerUid)return 'manager';
 if(uid===meta.kioskUid&&meta.kioskEmail)return 'kiosk';
 return null;
}
export function allowedAction(role:StoreRole|null,action:string){return role==='manager'||(role==='kiosk'&&['in','out'].includes(action));}
export function storeSettings(value:any):{name:string;location:StoreLocation;geofenceEnabled:boolean}{
 const name=typeof value?.name==='string'?value.name.trim():'';
 const location=value?.location,address=typeof location?.address==='string'?location.address.trim():'';
 if(!name||name.length>100)throw Error('Enter a store name (up to 100 characters).');
 if(!address||address.length>300||![location.latitude,location.longitude,location.radiusMeters].every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(location.latitude)>90||Math.abs(location.longitude)>180||location.radiusMeters<20||location.radiusMeters>1000)throw Error('Enter the store address, valid latitude/longitude, and radius from 20 to 1000 meters.');
 if(value.geofenceEnabled!==undefined&&typeof value.geofenceEnabled!=='boolean')throw Error('Choose whether location locking is enabled.');
 return {name,location:{address,latitude:location.latitude,longitude:location.longitude,radiusMeters:location.radiusMeters},geofenceEnabled:value.geofenceEnabled!==false};
}
export function sameOrigin(request:Request){try{const origin=new URL(request.headers.get('origin')??'');return ['http:','https:'].includes(origin.protocol)&&origin.host===request.headers.get('host');}catch{return false;}}
