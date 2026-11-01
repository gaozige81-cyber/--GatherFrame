'use client';
import {useEffect,useState} from 'react';
import {RefreshCw,Download,X} from 'lucide-react';
import type {UpdateStatus} from '../lib/preferences';
import appMetadata from '../../desktop/app/package.json';

export default function SoftwareUpdates({visible,notify}:{visible:boolean;notify:(message:string)=>void}){
 const [desktop,setDesktop]=useState(false),[status,setStatus]=useState<UpdateStatus|null>(null),[source,setSource]=useState(''),[autoCheck,setAutoCheck]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[info,setInfo]=useState(''),[dismissed,setDismissed]=useState('');
 useEffect(()=>{
  const bridge=window.shicaiDesktop;if(!bridge)return;setDesktop(true);let alive=true;
  const unsubscribe=bridge.onUpdateStatus(value=>{if(alive)setStatus(value)});
  bridge.getUpdateStatus().then(value=>{if(alive){setStatus(value);setSource(value.config.source);setAutoCheck(value.config.autoCheck)}}).catch(()=>{if(alive)setError('无法读取更新设置，请重新打开拾材。')});
  return()=>{alive=false;unsubscribe()};
 },[]);
 const checking=busy==='check'||status?.phase==='checking';
 const dirty=!!status&&(source.trim()!==status.config.source||autoCheck!==status.config.autoCheck);
 const canOpen=status?.phase==='available'&&!!(status.downloadUrl||status.releaseUrl);
 async function save(){
  const bridge=window.shicaiDesktop;if(!bridge||busy)return;setBusy('save');setError('');setInfo('');
  try{const result=await bridge.configureUpdates({source,autoCheck});if(!result.ok||!result.status)throw Error(result.error||'更新设置保存失败');setStatus(result.status);setSource(result.status.config.source);setAutoCheck(result.status.config.autoCheck);setInfo('更新设置已保存。')}
  catch(e){setError(e instanceof Error?e.message:'更新设置保存失败')}
  finally{setBusy('')}
 }
 async function check(){
  const bridge=window.shicaiDesktop;if(!bridge||busy||dirty)return;setBusy('check');setError('');setInfo('');
  try{setStatus(await bridge.checkForUpdates())}catch{setError('检查更新失败，请稍后重试。')}finally{setBusy('')}
 }
 async function open(){
  if(!window.shicaiDesktop||!canOpen)return;
  try{const result=await window.shicaiDesktop.openUpdate();if(!result.ok)notify(result.error||'无法打开更新链接')}catch{notify('无法打开更新链接，请稍后重试。')}
 }
 return <>
  {status?.phase==='available'&&dismissed!==status.latestVersion&&<aside className="update-notice" role="status"><div><b>拾材 {status.latestVersion} 已发布</b><p>{status.downloadUrl?'可以打开下载链接，安装时由你确认。':'当前系统的安装包尚未提供，可查看发布信息。'}</p></div>{canOpen&&<button className="outline" onClick={open}><Download size={14}/>{status.downloadUrl?'下载新版':'查看发布页'}</button>}<button className="icon" aria-label="稍后提醒更新" onClick={()=>setDismissed(status.latestVersion)}><X size={15}/></button></aside>}
  <section id="software-updates" className="software-update-panel" hidden={!visible}>
   <div className="update-panel-heading"><h2>软件更新</h2><span>当前版本 {status?.currentVersion||appMetadata.version}</span></div>
   {!desktop?<p>自动检测更新用于桌面版。网页版由发布者更新。</p>:<>
    <div className={'update-status '+(status?.phase||'idle')} role="status"><b>{status?.message||'正在读取更新设置…'}</b>{status?.checkedAt&&<small>本次检查：{new Date(status.checkedAt).toLocaleString('zh-CN')}</small>}{status?.latestVersion&&<small>更新源版本：{status.latestVersion}</small>}</div>
    <label className="update-source">版本发布地址<input aria-label="更新源地址" type="url" value={source} maxLength={2048} disabled={!!busy||checking||!status} onChange={e=>{setSource(e.target.value);setError('');setInfo('');if(!e.target.value.trim())setAutoCheck(false)}} placeholder="GitHub 仓库地址，或公开的 HTTPS 版本信息地址"/></label>
    <p>目前没有预设发布地址。准备好 GitHub 仓库或版本信息地址后填入；未配置时不会自动联网检查。</p>
    <label className="update-auto"><input aria-label="启动时自动检查更新" type="checkbox" checked={autoCheck} disabled={!source.trim()||!!busy||checking||!status} onChange={e=>{setAutoCheck(e.target.checked);setInfo('')}}/>启动时自动检查（每 6 小时最多一次）</label>
    <p>发现新版会在应用内提示，不会自动运行安装程序。手动检查不受 6 小时间隔限制。</p>
    <div className="update-controls"><button className="outline" disabled={!!busy||checking||!status} onClick={save}>{busy==='save'?'正在保存…':'保存更新设置'}</button><button className="primary" disabled={!!busy||checking||!status?.config.source||dirty} onClick={check}><RefreshCw size={15} className={checking?'spin':''}/>{checking?'正在检查…':'检查更新'}</button>{canOpen&&<button className="outline" onClick={open}><Download size={15}/>{status?.downloadUrl?'下载新版':'查看发布页'}</button>}</div>
    {dirty&&<p className="update-feedback">设置尚未保存，请先保存再检查。</p>}{info&&<p className="update-feedback" role="status">{info}</p>}{error&&<p className="update-error" role="alert">{error}</p>}
    {status?.notes&&<details className="update-release-notes"><summary>查看版本说明</summary><p>{status.notes}</p></details>}
   </>}
  </section>
 </>;
}
