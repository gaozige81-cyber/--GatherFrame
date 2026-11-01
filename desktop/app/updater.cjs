const {isIP}=require('node:net');
const {publicIP}=require('./safe-network.cjs');
const SIX_HOURS=6*60*60*1000;

function httpsUrl(value){
 if(typeof value!=='string'||!value.trim()||value.length>2048)throw Error('请填写公开的 HTTPS 更新地址');
 let u;try{u=new URL(value.trim())}catch{throw Error('更新地址格式不正确')}
 const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')&&!host.includes(':')||host==='localhost'||/\.(local|internal|localhost|test|invalid|example|onion)$/.test(host)||isIP(host)&&!publicIP(host))throw Error('更新源必须使用公开的 HTTPS 地址，不能包含账号密码或指向本机、内网');
 u.hash='';return u.href;
}
function feedAddress(value){
 const source=httpsUrl(value),u=new URL(source);
 if(u.hostname==='github.com'){
  const m=u.pathname.match(/^\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/releases(?:\/latest)?)?\/?$/);
  if(!m)throw Error('请填写 GitHub 仓库地址，例如 https://github.com/用户名/仓库名');
  return `https://api.github.com/repos/${m[1]}/${m[2]}/releases/latest`;
 }
 return source;
}
function parseVersion(value){
 if(typeof value!=='string'||value.length>80)throw Error('更新源没有有效的版本号');
 const m=value.trim().match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
 if(!m||m.slice(1,4).some(n=>!Number.isSafeInteger(Number(n))))throw Error('更新源没有有效的版本号');
 return {text:m.slice(1,4).join('.')+(m[4]?'-'+m[4]:''),parts:m.slice(1,4).map(Number),prerelease:!!m[4]};
}
function newer(latest,current){const a=parseVersion(latest),b=parseVersion(current);for(let i=0;i<3;i++){if(a.parts[i]!==b.parts[i])return a.parts[i]>b.parts[i]}return false}
function configValue(raw={}){
 const source=typeof raw.source==='string'?raw.source.trim():'';if(source)feedAddress(source);
 return {source,autoCheck:!!source&&raw.autoCheck===true,lastAutomaticCheckAt:Number.isFinite(Date.parse(raw.lastAutomaticCheckAt))?raw.lastAutomaticCheckAt:''};
}
async function jsonBody(response){
 const cap=512*1024;if(Number(response.headers.get('content-length')||0)>cap){await response.body?.cancel();throw Error('更新信息超过大小限制')}
 const reader=response.body?.getReader();if(!reader)throw Error('更新源返回了空内容');const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>cap)throw Error('更新信息超过大小限制');chunks.push(value)}}catch(e){await reader.cancel().catch(()=>{});throw e}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw Error('更新地址未返回有效的 JSON 版本信息')}
}
function releaseInfo(data,platform,arch,distribution='standard'){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('更新信息格式不正确');
 const github=typeof data.tag_name==='string';
 const version=parseVersion(github?data.tag_name:data.version);
 if(data.draft||data.prerelease||version.prerelease)throw Error('更新源没有可用的正式版本');
 const optionalUrl=value=>value?httpsUrl(value):'';
 const releaseUrl=optionalUrl(github?data.html_url:data.releaseUrl);
 let downloadUrl='';
 if(github){
  const patterns={'win32-x64':/windows[-_]x64[-_].*setup.*\.exe$/i,'darwin-arm64':/macos[-_]arm64[-_].*\.zip$/i,'darwin-x64':/macos[-_]x64[-_].*\.zip$/i};
  const key=platform+'-'+arch;
  const pattern=distribution==='legacy'&&key==='darwin-x64'?/macos[-_]x64[-_]Legacy[-_]Installer\.zip$/i:distribution==='bigsur'&&key==='darwin-arm64'?/macos[-_]arm64[-_]BigSur[-_]Installer\.zip$/i:patterns[key];
  const asset=pattern&&(Array.isArray(data.assets)?data.assets:[]).find(a=>a&&typeof a.name==='string'&&pattern.test(a.name)&&(distribution!=='standard'||!/(?:legacy|bigsur)/i.test(a.name)));
  if(asset)downloadUrl=optionalUrl(asset.browser_download_url);
 }else{
  downloadUrl=optionalUrl(data.downloads?.[platform+'-'+arch+(distribution==='standard'?'':'-'+distribution)]);
 }
 return {version:version.text,notes:String((github?data.body:data.notes)||'').slice(0,8000),releaseUrl,downloadUrl};
}
function messageFor(error){const message=error instanceof Error?error.message:'';return /^[\u3400-\u9fff]/.test(message)&&message.length<=220?message:'无法连接更新源，请检查网络后重试'}

function createUpdateChecker({version,platform,arch,distribution='standard',defaults={},readConfig=()=>null,writeConfig=()=>{},fetch,openExternal=async()=>{},onStatus=()=>{},now=()=>Date.now()}){
 parseVersion(version);let config;
 try{config=configValue(readConfig()||defaults)}catch{config=configValue({})}
 let state={phase:config.source?'idle':'unconfigured',message:config.source?'尚未检查更新':'尚未配置更新源，当前不会自动检查更新',latestVersion:'',checkedAt:'',notes:'',downloadUrl:'',releaseUrl:''};
 let revision=0,pending=null,controller=null,startupDone=false;
 function status(){return {...state,currentVersion:version,platform,arch,config:{source:config.source,autoCheck:config.autoCheck}}}
 function publish(next){state={...state,...next};try{onStatus(status())}catch{}return status()}
 function configure(raw){
  const next=configValue(raw);
  try{writeConfig(next)}catch{throw Error('无法保存更新设置，请检查用户目录权限')}
  revision++;controller?.abort();controller=null;pending=null;config=next;
  return publish({phase:config.source?'idle':'unconfigured',message:config.source?'更新源已保存，点击“检查更新”验证连接':'尚未配置更新源，当前不会自动检查更新',latestVersion:'',checkedAt:'',notes:'',downloadUrl:'',releaseUrl:''});
 }
 function check(){
  if(!config.source)return Promise.resolve(publish({phase:'unconfigured',message:'尚未配置更新源，当前不会自动检查更新'}));
  if(pending)return pending;
  const token=revision,source=config.source;controller=new AbortController();const abort=controller;
  const timeout=setTimeout(()=>abort.abort(),15000);timeout.unref?.();
  publish({phase:'checking',message:'正在检查更新…'});
  pending=Promise.resolve().then(async()=>{
   try{
    let target=feedAddress(source),response;
    for(let hop=0;hop<4;hop++){
     const headers={Accept:'application/json','User-Agent':`ShiCai/${version}`};
     if(new URL(target).hostname==='api.github.com'){headers.Accept='application/vnd.github+json';headers['X-GitHub-Api-Version']='2026-03-10'}
     response=await fetch(target,{headers,redirect:'manual',signal:abort.signal});
     if(![301,302,303,307,308].includes(response.status))break;
     const location=response.headers.get('location');await response.body?.cancel();
     if(!location)throw Error('更新源重定向无效');target=httpsUrl(new URL(location,target).href);response=null;
    }
    if(!response)throw Error('更新源重定向次数过多');
    if(!response.ok){await response.body?.cancel();throw Error(response.status===404?'更新源尚未发布版本，或地址不存在':[403,429].includes(response.status)?'更新源暂时限制了请求，请稍后再试':`更新源返回错误（${response.status}）`)}
    const info=releaseInfo(await jsonBody(response),platform,arch,distribution);
    if(token!==revision)return status();
    if(abort.signal.aborted)throw Error('检查更新超时，请稍后重试');
    const available=newer(info.version,version);
    return publish({phase:available?'available':'current',latestVersion:info.version,checkedAt:new Date(now()).toISOString(),notes:info.notes,releaseUrl:info.releaseUrl,downloadUrl:info.downloadUrl,message:available?`发现新版本 ${info.version}${info.downloadUrl?'':'，暂未提供当前系统的安装包'}`:'当前版本无需更新'});
   }catch(error){
    if(token!==revision)return status();
    return publish({phase:'error',message:abort.signal.aborted?'检查更新超时，请稍后重试':messageFor(error),checkedAt:new Date(now()).toISOString(),latestVersion:'',downloadUrl:'',releaseUrl:'',notes:''});
   }finally{clearTimeout(timeout);if(token===revision){pending=null;controller=null}}
  });
  return pending;
 }
 async function checkOnStartup(){
  if(startupDone)return status();startupDone=true;
  if(!config.autoCheck||!config.source)return status();
  const elapsed=now()-Date.parse(config.lastAutomaticCheckAt);
  if(Number.isFinite(elapsed)&&elapsed>=0&&elapsed<SIX_HOURS)return status();
  const next={...config,lastAutomaticCheckAt:new Date(now()).toISOString()};
  try{writeConfig(next);config=next}catch{return publish({phase:'error',message:'无法记录自动检查时间，请手动检查更新'})}
  return check();
 }
 async function open(){
  if(state.phase!=='available')return{ok:false,error:'当前没有可打开的新版本链接'};
  const target=state.downloadUrl||state.releaseUrl;if(!target)return{ok:false,error:'更新源未提供下载或发布页链接'};
  try{await openExternal(httpsUrl(target));return{ok:true}}catch{return{ok:false,error:'无法打开更新链接，请稍后重试'}}
 }
 function dispose(){revision++;controller?.abort();pending=null;controller=null}
 return {status,configure,check,checkOnStartup,open,dispose};
}
module.exports={createUpdateChecker,httpsUrl,feedAddress,parseVersion,newer,releaseInfo};
