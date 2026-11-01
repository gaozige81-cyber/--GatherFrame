// Resolve once and pin the selected public address for the actual socket.
const dns=require('node:dns/promises');const http=require('node:http');const https=require('node:https');const {Readable}=require('node:stream');
function publicIP(host){host=host.toLowerCase().replace(/^\[|\]$/g,'');if(host.includes(':'))return /^[23][\da-f]{3}:/.test(host)&&!/^2001:(?:db8|0|10|20):/i.test(host)&&!host.startsWith('2002:');const n=host.split('.').map(Number);return n.length===4&&n.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&![0,10,127].includes(n[0])&&n[0]<224&&!(n[0]===100&&n[1]>=64&&n[1]<=127)&&!(n[0]===169&&n[1]===254)&&!(n[0]===172&&n[1]>=16&&n[1]<=31)&&!(n[0]===192&&(n[1]===168||n[1]===0||n[1]===2))&&!(n[0]===198&&(n[1]===18||n[1]===19||n[1]===51))&&!(n[0]===203&&n[1]===0&&n[2]===113)}
async function safeFetch(raw,init={}){
 const u=new URL(raw);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||(u.port&&!['80','443'].includes(u.port))||u.hostname==='localhost'||/\.(local|internal|localhost|test|invalid|onion)$/.test(u.hostname))throw Error('仅支持公共网站地址');
 const addresses=await dns.lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true});
 if(!addresses.length||addresses.some(a=>!publicIP(a.address)))throw Error('禁止访问本机或内网地址');
 // Prefer IPv4 on networks with incomplete IPv6 connectivity. Every retry uses
 // an address from this validated DNS snapshot, pinned to the actual socket.
 const candidates=addresses.sort((a,b)=>a.family-b.family).slice(0,3);
 let lastError;
 for(const pinned of candidates){
  if(init.signal?.aborted)throw Error('已取消');
  try{return await new Promise((resolve,reject)=>{
   const request=(u.protocol==='https:'?https:http).request(u,{method:'GET',headers:init.headers,signal:init.signal,lookup:(_host,options,cb)=>options?.all?cb(null,[pinned]):cb(null,pinned.address,pinned.family)},response=>{
    const headers=new Headers();for(const[k,v]of Object.entries(response.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):v);
    resolve(new Response(Readable.toWeb(response),{status:response.statusCode,headers}));
   });
   request.setTimeout(6000,()=>request.destroy(Object.assign(Error('连接来源超时'),{code:'ETIMEDOUT'})));
   request.on('error',reject);request.end();
  })}catch(error){
   lastError=error;
   if(init.signal?.aborted||!['ECONNRESET','ETIMEDOUT','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','EAI_AGAIN'].includes(error.code))throw error;
  }
 }
 throw lastError;
}

module.exports={safeFetch,publicIP};
