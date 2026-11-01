const assert=require('node:assert/strict');
const {createUpdateChecker,feedAddress,httpsUrl,newer,releaseInfo}=require('./app/updater.cjs');
const source='https://updates.shicai-app.com/latest.json';
const feed=(version='2.2.5')=>({version,notes:'新版说明',releaseUrl:'https://updates.shicai-app.com/releases/2.2.5',downloads:{'win32-x64':'https://updates.shicai-app.com/ShiCai-2.2.5-Windows-x64-Setup.exe','darwin-arm64':'https://updates.shicai-app.com/ShiCai-2.2.5-macOS-arm64-Installer.zip','darwin-x64':'https://updates.shicai-app.com/ShiCai-2.2.5-macOS-x64-Installer.zip'}});
const github={tag_name:'v2.2.5',draft:false,prerelease:false,html_url:'https://github.com/demo/shicai/releases/tag/v2.2.5',body:'GitHub release notes',assets:Object.entries(feed().downloads).map(([key,url])=>({name:url.split('/').pop(),browser_download_url:url}))};
// Legacy installations must never be offered the standard higher-OS package.
const mixed={...github,assets:[{name:'ShiCai-2.2.5-macOS-x64-Legacy-Installer.zip',browser_download_url:'https://updates.shicai-app.com/legacy.zip'},{name:'ShiCai-2.2.5-macOS-arm64-BigSur-Installer.zip',browser_download_url:'https://updates.shicai-app.com/bigsur.zip'},...github.assets]};
assert.equal(releaseInfo(mixed,'darwin','x64').downloadUrl,feed().downloads['darwin-x64']);
assert.equal(releaseInfo(mixed,'darwin','x64','legacy').downloadUrl,'https://updates.shicai-app.com/legacy.zip');
assert.equal(releaseInfo(mixed,'darwin','arm64','bigsur').downloadUrl,'https://updates.shicai-app.com/bigsur.zip');
assert.equal(releaseInfo(github,'darwin','x64','legacy').downloadUrl,'');
assert.equal(releaseInfo(feed(),'darwin','arm64','bigsur').downloadUrl,'');
assert.equal(releaseInfo({...feed(),downloads:{'darwin-x64-legacy':'https://updates.shicai-app.com/legacy.zip'}},'darwin','x64','legacy').downloadUrl,'https://updates.shicai-app.com/legacy.zip');
function make(extra={}){return createUpdateChecker({version:'2.2.4',platform:'win32',arch:'x64',fetch:async()=>Response.json(feed()),...extra})}

(async()=>{
 let calls=0;
 let checker=make({fetch:async()=>{calls++;return Response.json(feed())}});
 assert.equal(checker.status().phase,'unconfigured');assert.equal((await checker.check()).phase,'unconfigured');await checker.checkOnStartup();assert.equal(calls,0,'no publishing address means no request');assert.equal((await checker.open()).ok,false);
 assert.equal(feedAddress('https://github.com/demo/shicai.git'),'https://api.github.com/repos/demo/shicai/releases/latest');
 assert.equal(feedAddress('https://github.com/demo/shicai/releases/latest'),'https://api.github.com/repos/demo/shicai/releases/latest');
 for(const raw of ['http://updates.shicai-app.com/latest.json','https://127.1/a','https://[::1]/x','https://localhost/feed','https://10.1.2.3/feed','https://user:secret@updates.shicai-app.com/feed','https://updates.shicai-app.com:8443/feed'])assert.throws(()=>httpsUrl(raw));
 assert.equal(newer('v2.10.0','2.9.9'),true);assert.equal(newer('2.2.4+build.7','2.2.4'),false);assert.equal(newer('2.2.3','2.2.4'),false);assert.throws(()=>newer('latest','2.2.4'));
 let stored,opened;
 checker=make({writeConfig:v=>stored=structuredClone(v),openExternal:async url=>opened=url});
 checker.configure({source,autoCheck:true,secret:'must not persist'});assert.equal(stored.autoCheck,true);assert.equal(stored.secret,undefined);
 let result=await checker.check();assert.equal(result.phase,'available');assert.equal(result.latestVersion,'2.2.5');assert.equal((await checker.open()).ok,true);assert.equal(opened,feed().downloads['win32-x64']);
 for(const [platform,arch] of [['win32','x64'],['darwin','arm64'],['darwin','x64']]){
  assert.equal(releaseInfo(github,platform,arch).downloadUrl,feed().downloads[platform+'-'+arch]);
 }
 checker=make({defaults:{source},fetch:async()=>Response.json(feed('2.2.4'))});assert.equal((await checker.check()).phase,'current');
 checker=make({defaults:{source},fetch:async()=>new Response('offline',{status:502})});assert.equal((await checker.check()).phase,'error');
 checker=make({defaults:{source},fetch:async()=>new Response('<html>not a feed</html>')});assert.equal((await checker.check()).phase,'error');
 checker=make({defaults:{source},fetch:async()=>Response.json(feed('2.3.0-beta.1'))});assert.equal((await checker.check()).phase,'error');
 checker=make({defaults:{source},fetch:async()=>new Response('{}',{headers:{'content-length':'999999'}})});assert.equal((await checker.check()).phase,'error');
 let redirects=0;checker=make({defaults:{source},fetch:async()=>{redirects++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}})}});assert.equal((await checker.check()).phase,'error');assert.equal(redirects,1);
 const noAsset=feed();noAsset.downloads={};checker=make({defaults:{source},fetch:async()=>Response.json(noAsset)});result=await checker.check();assert.equal(result.phase,'available');assert.equal(result.downloadUrl,'');assert.match(result.message,/当前系统/);
 let autoStored={source,autoCheck:true};let clock=Date.parse('2026-10-26T12:00:00Z'),autoCalls=0;
 const autoArgs={now:()=>clock,readConfig:()=>autoStored,writeConfig:v=>autoStored=structuredClone(v),fetch:async()=>{autoCalls++;return Response.json(feed())}};
 checker=make(autoArgs);await checker.checkOnStartup();await checker.checkOnStartup();assert.equal(autoCalls,1);
 checker=make(autoArgs);await checker.checkOnStartup();assert.equal(autoCalls,1,'automatic checks are throttled across launches');await checker.check();assert.equal(autoCalls,2,'manual check bypasses automatic interval');
 clock+=6*60*60*1000;checker=make(autoArgs);await checker.checkOnStartup();assert.equal(autoCalls,3);
 let finish,requestCount=0;checker=make({defaults:{source},fetch:()=>{requestCount++;return new Promise(resolve=>finish=resolve)}});
 const one=checker.check(),two=checker.check();await Promise.resolve();assert.equal(requestCount,1);finish(Response.json(feed()));await Promise.all([one,two]);
 let late;checker=make({defaults:{source},fetch:()=>new Promise(resolve=>late=resolve)});
 const old=checker.check();await Promise.resolve();checker.configure({source:'https://updates.shicai-app.com/other.json',autoCheck:false});late(Response.json(feed()));await old;assert.equal(checker.status().phase,'idle');assert.equal(checker.status().latestVersion,'');
 checker=make({defaults:{source},writeConfig:()=>{throw Error('disk full')}});assert.throws(()=>checker.configure({source:'https://updates.shicai-app.com/other.json'}),/无法保存/);assert.equal(checker.status().config.source,source);
 checker=make({defaults:{source},fetch:()=>{throw Error('synchronous transport failure')}});await checker.check();assert.equal(checker.status().phase,'error');await checker.check();assert.equal(checker.status().phase,'error');
 console.log(JSON.stringify({passed:true,checks:['unconfigured state makes zero requests','public HTTPS and redirect validation','numeric stable version comparison','correct Windows and Mac asset selection','no false latest status after network or invalid-feed failure','size cap and prerelease handling','six-hour automatic interval and manual override','request coalescing','changing source discards old response','settings-write failure preserves previous config','opening requires an available update']}));
})().catch(error=>{console.error(error);process.exitCode=1});
