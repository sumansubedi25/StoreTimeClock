// Building pin for 9625 Webb Chapel Rd, Dallas, TX 75220.
// Source: https://www.google.com/maps/search/9625%20Webb%20Chapel%20Rd%2C%20Dallas%2C%20TX%2075220%2C%20USA/32.86440834226741%2C-96.86217945708233
export const STORE_LOCATION={latitude:32.86440834226741,longitude:-96.86217945708233,radiusMeters:91.44,address:'9625 Webb Chapel Rd, Suite 100A, Dallas, TX 75220'};
export type StoreLocation=typeof STORE_LOCATION;
export type LocationReading={latitude:number;longitude:number;accuracy:number;timestamp:number};
export function distanceMeters(latitude:number,longitude:number,store:StoreLocation=STORE_LOCATION){const rad=(v:number)=>v*Math.PI/180;const a=Math.sin(rad(latitude-store.latitude)/2)**2+Math.cos(rad(store.latitude))*Math.cos(rad(latitude))*Math.sin(rad(longitude-store.longitude)/2)**2;return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));}
export function locationError(value:unknown,now=Date.now(),store:StoreLocation|null=STORE_LOCATION):string|null{
 if(!store)return 'The manager must configure this store’s clock-in location first.';
 if(!value||typeof value!=='object')return 'Location is required to clock in. Allow location access and try again.';
 const p=value as LocationReading;
 if(![p.latitude,p.longitude,p.accuracy,p.timestamp].every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||p.accuracy<0)return 'Invalid location reading. Please try again.';
 if(now-p.timestamp>60000||p.timestamp-now>10000)return 'Your location reading expired. Please clock in again for a fresh reading.';
 if(p.accuracy>50)return 'Location is not accurate enough. Enable precise location or move near a window, then try again.';
 if(distanceMeters(p.latitude,p.longitude,store)>store.radiusMeters)return `Clock-in is only allowed within ${Math.round(store.radiusMeters/0.3048)} feet of ${store.address}.`;
 return null;
}
export function currentLocation():Promise<LocationReading>{return new Promise((resolve,reject)=>{
 if(typeof navigator==='undefined'||!navigator.geolocation){reject(Error('This browser cannot check your location. Use a phone or another browser with location enabled.'));return;}
 navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>reject(Error(e.code===1?'Location access was denied. Allow location access in your browser settings to clock in.':e.code===3?'Location check timed out. Move near a window and try again.':'Unable to find your location. Enable location services and precise location, then try again.')),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
});}
