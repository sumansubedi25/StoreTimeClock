import {fail} from './firebase-clock';
export const NORMAL_BODY_LIMIT=10000;
export const IMPORT_BODY_LIMIT=20000000;
// Count actual streamed bytes; Content-Length alone is not a trusted limit.
export async function boundedJson(req:Request,limit=NORMAL_BODY_LIMIT):Promise<any>{
 const length=req.headers.get('content-length');
 if(length!==null&&/^\d+$/.test(length)&&Number(length)>limit){void req.body?.cancel().catch(()=>{});fail('Request too large.',413);}
 if(!req.body)fail('Invalid request.');
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){void reader.cancel().catch(()=>{});fail('Request too large.',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 let body:any;try{body=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}catch{fail('Invalid request.');}
 if(!body||typeof body!=='object'||Array.isArray(body))fail('Invalid request.');
 return body;
}
