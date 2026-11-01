require('./compat.cjs');
const {app,BrowserWindow,Menu,shell,dialog,net,session,ipcMain,safeStorage,clipboard}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const {safeName,fileError,writeAtomically,readJson,writeJson}=require('./file-utils.cjs');
const {createAI,publicError}=require('./ai.cjs');
const {createCredentialStore}=require('./ai-credentials.cjs');
const {createUpdateChecker}=require('./updater.cjs');
let window,service,localOrigin,saving=false,updates,updateTimer;
app.setName('拾材');
globalThis.__shicaiSafeFetch=require('./safe-network.cjs').safeFetch;app.setAppUserModelId('app.shicai.desktop');
if(!app.requestSingleInstanceLock()){app.quit()}else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus()}});
app.whenReady().then(async()=>{
 globalThis.fetch=(input,init)=>net.fetch(input,init);
 const credentialFile=path.join(app.getPath('userData'),'ai-credentials.json');
 const credentialStore=createCredentialStore({safeStorage,read:()=>{try{const raw=fs.readFileSync(credentialFile);return raw.length<20000?JSON.parse(raw):null}catch{return null}},write:value=>{
  fs.mkdirSync(app.getPath('userData'),{recursive:true});const temporary=credentialFile+'.new';
  try{fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600});fs.renameSync(temporary,credentialFile)}finally{try{fs.unlinkSync(temporary)}catch{}}
 }});
 const ai=createAI((input,init)=>net.fetch(input,init),{credentialStore,readConfig:()=>readJson(path.join(app.getPath('userData'),'ai-services.json')),writeConfig:config=>writeJson(path.join(app.getPath('userData'),'ai-services.json'),config)});
 fs.mkdirSync(app.getPath('userData'),{recursive:true});
 const stateFile=path.join(app.getPath('userData'),'local-port.json'),prefsFile=path.join(app.getPath('userData'),'preferences.json'),nativeFile=path.join(app.getPath('userData'),'download-settings.json');
 let nativePrefs=readJson(nativeFile,{});
 updates=createUpdateChecker({version:require('./package.json').version,platform:process.platform,arch:process.arch,distribution:require('./distribution.json').channel,defaults:require('./update-channel.json'),readConfig:()=>readJson(path.join(app.getPath('userData'),'update-settings.json')),writeConfig:value=>writeJson(path.join(app.getPath('userData'),'update-settings.json'),value),fetch:require('./safe-network.cjs').safeFetch,openExternal:url=>shell.openExternal(url),onStatus:status=>{if(window&&!window.isDestroyed?.())window.webContents.send?.('shicai:update-status',status)}});
 async function checkUpdatesFromMenu(){const result=await updates.check();const canOpen=result.phase==='available'&&!!(result.downloadUrl||result.releaseUrl);const choice=await dialog.showMessageBox(window,{type:result.phase==='error'?'warning':'info',title:'软件更新',message:result.message,detail:'当前版本：'+result.currentVersion+(result.latestVersion?'\n更新源版本：'+result.latestVersion:'')+(result.phase==='unconfigured'?'\n在偏好设置的“软件更新”中配置 GitHub 仓库或公开 HTTPS 更新地址。':''),buttons:canOpen?['稍后','打开下载链接']:['确定'],defaultId:0,cancelId:0});if(canOpen&&choice.response===1)await updates.open();}
 function defaultDirectory(){for(const dir of [nativePrefs.downloadDir,app.getPath('downloads'),app.getPath('documents'),app.getPath('home')]){if(typeof dir==='string'){try{if(fs.statSync(dir).isDirectory())return dir}catch{}}}return app.getPath('home')}
 const {startServer}=await import('./server.mjs');const lastPort=readJson(stateFile,{})?.port;try{service=await startServer(lastPort>1024&&lastPort<65536?lastPort:0)}catch{service=await startServer()}
 localOrigin=service.url;try{writeJson(stateFile,{port:Number(new URL(localOrigin).port)})}catch{}
 const trusted=event=>!!window&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url.startsWith(localOrigin+'/');
 function handle(channel,callback){ipcMain.handle(channel,async(event,...args)=>{if(!trusted(event))throw Error('不允许的请求来源');return callback(...args)})}
 function rememberDirectory(dir){nativePrefs={downloadDir:dir};try{writeJson(nativeFile,nativePrefs)}catch{}}
 handle('shicai:settings',()=>({state:readJson(prefsFile),downloadDir:defaultDirectory()}));
 handle('shicai:state',state=>{try{if(!state||typeof state!=='object')return{ok:false};const clean={profile:state.profile,saved:state.saved,history:state.history,mirror:state.mirror,queue:state.queue,projectName:state.projectName,recipe:state.recipe,runs:state.runs};if(Buffer.byteLength(JSON.stringify(clean))>6*1024*1024)return{ok:false};writeJson(prefsFile,clean);return{ok:true}}catch{return{ok:false}}});
 handle('shicai:update-status',()=>updates.status());
 handle('shicai:update-config',raw=>{try{return{ok:true,status:updates.configure(raw)}}catch(e){return{ok:false,error:/^[\u3400-\u9fff]/.test(e.message||'')?e.message:'更新设置无效'}}});
 handle('shicai:update-check',()=>updates.check());
 handle('shicai:update-open',()=>updates.open());
 handle('shicai:ai-open-web',async input=>{
  const website=require('./ai-catalog.json').web.find(site=>site.id===input?.id);
  if(!website||typeof input?.prompt!=='string'||input.prompt.length>4000)return{ok:false,error:'官网入口或提示词无效。'};
  try{if(input.prompt.trim())clipboard.writeText(input.prompt);await shell.openExternal(website.url);return{ok:true,copied:!!input.prompt.trim()}}catch{return{ok:false,error:'未能打开官网，请稍后重试。'}}
 });
 handle('shicai:ai-key',value=>ai.setKey(value));
 handle('shicai:ai-clear',kind=>ai.clear(kind));
 handle('shicai:ai-configure',input=>ai.configure(input?.kind,input?.config,input?.key,input?.remember));
 handle('shicai:ai-models',async kind=>{try{return{ok:true,models:await ai.models(kind)}}catch(e){return{ok:false,error:publicError(e)}}});
 handle('shicai:ai-status',()=>ai.status());
 handle('shicai:ai-plan',async input=>{try{return{ok:true,plan:await ai.plan(input)}}catch(e){return{ok:false,error:publicError(e)}}});
 handle('shicai:ai-image',async input=>{try{return{ok:true,image:await ai.image(input)}}catch(e){return{ok:false,error:publicError(e)}}});
 handle('shicai:choose-folder',async()=>{const r=await dialog.showOpenDialog(window,{title:'选择默认下载目录',defaultPath:defaultDirectory(),properties:['openDirectory','createDirectory']});if(r.canceled)return{};const folder=r.filePaths[0];try{const probe=path.join(folder,`.shicai-write-test-${Date.now()}`);await fs.promises.writeFile(probe,'',{flag:'wx'});await fs.promises.unlink(probe);rememberDirectory(folder);return{path:folder}}catch(e){return{error:fileError(e)}}});
 handle('shicai:open-folder',async()=>{const dir=defaultDirectory();const message=await shell.openPath(dir);return message?{error:'无法打开目录，请重新选择下载文件夹。'}:{}});
 handle('shicai:save',async file=>{if(saving)return{status:'error',error:'另一个保存操作尚未完成，请先处理保存对话框。'};saving=true;try{if(!file||typeof file.name!=='string'||!(file.data instanceof Uint8Array)||file.data.byteLength>81*1024*1024)return{status:'error',error:'文件格式或大小不正确。'};const name=safeName(file.name),ext=path.extname(name).slice(1).toLowerCase();if(!['jpg','jpeg','png','webp','gif','zip','json','avif','tiff','tif','bmp','ico','svg'].includes(ext))return{status:'error',error:'仅支持图片、ZIP和资料备份文件。'};const r=await dialog.showSaveDialog(window,{title:'保存文件到…',defaultPath:path.join(defaultDirectory(),name),filters:[{name:ext==='zip'?'ZIP素材包':ext==='json'?'拾材资料备份':'图片文件',extensions:[ext]}],properties:['showOverwriteConfirmation','createDirectory']});if(r.canceled||!r.filePath)return{status:'canceled'};await writeAtomically(r.filePath,Buffer.from(file.data));rememberDirectory(path.dirname(r.filePath));return{status:'saved',path:r.filePath}}catch(e){return{status:'error',error:fileError(e)}}finally{saving=false}});
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===window?.webContents&&permission==='clipboard-sanitized-write'));
 session.defaultSession.setPermissionCheckHandler((wc,permission)=>wc===window?.webContents&&permission==='clipboard-sanitized-write');
 window=new BrowserWindow({width:1360,height:920,minWidth:760,minHeight:600,title:'拾材 · 素材收集与转换',backgroundColor:'#f7f7f2',icon:path.join(__dirname,'icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 function external(url){try{const u=new URL(url);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)shell.openExternal(u.href)}catch{}}
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return{action:'deny'}});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(localOrigin+'/')){event.preventDefault();external(url)}});
 window.webContents.session.on('will-download',(_event,item)=>{item.setSaveDialogOptions({title:'保存文件',defaultPath:path.join(defaultDirectory(),safeName(item.getFilename()))});item.once('done',(_e,state)=>{if(state==='interrupted')dialog.showMessageBox(window,{type:'warning',message:'保存中断，请检查网络、磁盘空间和目标文件夹权限后重试。'})})});
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'文件',submenu:[{label:'返回工作台',accelerator:'CmdOrCtrl+Home',click:()=>window.loadURL(localOrigin)},{label:'打开下载文件夹',click:()=>shell.openPath(defaultDirectory())},{type:'separator'},{role:'quit',label:'退出'}]},{label:'查看',submenu:[{role:'reload',label:'刷新',accelerator:'CmdOrCtrl+R'},{role:'resetZoom',label:'恢复缩放'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},{label:'帮助',submenu:[{label:'检查更新',click:()=>checkUpdatesFromMenu().catch(()=>{})},{type:'separator'},{label:'使用说明',click:()=>dialog.showMessageBox(window,{type:'info',title:'拾材 2.3.0',message:'拾材 · 素材收集与转换',detail:'Windows 10/11 x64，macOS 常规版 12+；Intel 旧系统兼容版 10.14+；Apple 芯片 Big Sur 兼容版 11+（按安装包选择）。无需登录账号。兼容性请以实机为准。\n在“个人与下载设置”更改头像、姓名和默认下载目录。每次保存都可更改盘符。\n个人资料、收藏和设置保存在当前系统用户的应用数据中，不随安装包转发。可导出备份进行迁移。\n公共图库需要本机能访问来源网站；国内搜图入口在默认浏览器打开。\n卸载保留个人资料；安装和移动程序目录不影响资料。'})}]}]));
 window.once('ready-to-show',()=>{window.show();updateTimer=setTimeout(()=>updates.checkOnStartup().catch(()=>{}),2500);updateTimer.unref?.()});await window.loadURL(localOrigin);window.on('closed',()=>window=null);
}).catch(err=>{dialog.showErrorBox('拾材启动失败',String(err.message||err));app.quit()});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{clearTimeout(updateTimer);updates?.dispose();service?.server.close()});
}
