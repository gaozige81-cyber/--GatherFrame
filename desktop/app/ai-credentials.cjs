// System encryption is optional. Never fall back to a plaintext credential file.
function createCredentialStore({safeStorage,read=()=>null,write=()=>{},platform=process.platform}){
 let entries={};try{const raw=read();if(raw&&typeof raw==='object')entries=raw}catch{}
 function available(){try{return safeStorage?.isEncryptionAvailable()===true&&(platform!=='linux'||safeStorage?.getSelectedStorageBackend?.()!=='basic_text')}catch{return false}}
 function identity(service){return service.baseUrl+'|'+service.protocol}
 function commit(next){write(next);entries=next}
 return{
  available,snapshot:()=>({...entries}),restore:raw=>commit(raw),
  get(kind,service){const item=entries[kind];if(!available()||!item||item.endpoint!==identity(service)||typeof item.ciphertext!=='string'||item.ciphertext.length>8192)return'';try{return safeStorage.decryptString(Buffer.from(item.ciphertext,'base64'))}catch{return''}},
  has(kind,service){return !!entries[kind]&&entries[kind].endpoint===identity(service)&&available()},
  save(kind,service,key){if(!available())throw Error('配置未保存：系统加密暂不可用，请取消“记住密钥”后重试。');const ciphertext=safeStorage.encryptString(key).toString('base64');commit({...entries,[kind]:{endpoint:identity(service),ciphertext}})},
  forget(kind){if(!entries[kind])return;const next={...entries};delete next[kind];commit(next)}
 };
}
module.exports={createCredentialStore};
