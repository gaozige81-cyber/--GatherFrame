export function imageType(b:Uint8Array):{mime:string;format:string;ext:string}|null {
 if(b.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n))return{mime:'image/png',format:'PNG',ext:'png'};
 if(b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255)return{mime:'image/jpeg',format:'JPG',ext:'jpg'};
 const s=(a:number,z:number)=>String.fromCharCode(...b.slice(a,z));
 if(b.length>=12&&s(0,4)==='RIFF'&&s(8,12)==='WEBP')return{mime:'image/webp',format:'WEBP',ext:'webp'};
 if(b.length>=10&&['GIF87a','GIF89a'].includes(s(0,6)))return{mime:'image/gif',format:'GIF',ext:'gif'};
 return null;
}
export async function readLimited(r:Response,cap:number){if(Number(r.headers.get('content-length')||0)>cap){await r.body?.cancel();throw new Error('来源文件超过大小限制')}const reader=r.body?.getReader();if(!reader)throw new Error('来源文件为空');let total=0;const chunks:Uint8Array[]=[];try{while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>cap)throw new Error('来源文件超过大小限制');chunks.push(value)}}catch(e){await reader.cancel();throw e}const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes}
