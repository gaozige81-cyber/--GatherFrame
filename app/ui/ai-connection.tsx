'use client';
import {useEffect,useState} from 'react';
import {KeyRound,Trash2,ExternalLink} from 'lucide-react';
import type {AIServiceConfig,AIStatus} from '../lib/preferences';
import catalog from '../../desktop/app/ai-catalog.json';
type Kind='plan'|'image';
type Provider={id:string;name:string;hint:string;keyUrl?:string;plan?:AIServiceConfig;image?:AIServiceConfig;models?:string[]};
const providers=catalog.providers as Provider[];
const protocols:Record<string,string>={responses:'Responses',chat:'Chat Completions','openai-image':'OpenAI 图像','compatible-image':'通用 Images','siliconflow-image':'硅基流动','gemini-image':'Google 原生图像','seedream-image':'Seedream','bfl-image':'FLUX 异步','ideogram-image':'Ideogram','stability-image':'Stability','grok-image':'Grok Imagine'};
const names:Record<string,string>={'gpt-image-2.5-flare':'日常创作 · Flare（推荐）','gpt-image-2.5-sunburst':'精细创作 · Sunburst','gemini-nano-banana-2.1':'Nano Banana 2.1（推荐）','gemini-3.1-flash-image':'Nano Banana 2','gemini-3-pro-image':'Nano Banana Pro','doubao-seedream-5-0-lite-260128':'Seedream 5 Lite（推荐）','doubao-seedream-4-5-251128':'Seedream 4.5','doubao-seedream-4-0-250828':'Seedream 4','qwen-image-3.0':'千问图像 3.0（推荐）','qwen-image-3.0-pro':'千问图像 3.0 Pro','qwen-image-2.1-turbo':'千问图像 2.1 Turbo','Kwai-Kolors/Kolors':'可图 Kolors（推荐）','Qwen/Qwen-Image':'千问图像','flux-2-pro':'FLUX.2 Pro（推荐）','flux-2-klein-4b':'FLUX.2 Klein','flux-kontext-pro':'FLUX Kontext Pro','ideogram-3':'Ideogram 3','recraftv4_1':'Recraft V4.1（推荐）','recraftv4':'Recraft V4','recraftv3':'Recraft V3',core:'Stable Image Core（推荐）',ultra:'Stable Image Ultra','grok-imagine-image-2.0':'Grok Imagine 2.0（推荐）','grok-imagine-image':'Grok Imagine'};
function identify(kind:Kind,s:AIServiceConfig){return providers.find(p=>p.id!=='custom'&&p[kind]?.baseUrl===s.baseUrl&&p[kind]?.protocol===s.protocol)?.id||'custom'}
export function AIConnection({kind,status,disabled,onStatus,onMessage,onDirty}:{kind:Kind;status:AIStatus;disabled:boolean;onStatus:(s:AIStatus)=>void;onMessage:(s:string)=>void;onDirty?:(kind:Kind,value:boolean)=>void}){
 const service=status.services[kind],label=kind==='plan'?'策划':'生图';
 const clean=()=>({baseUrl:service.baseUrl,model:service.model,protocol:service.protocol,jsonMode:service.jsonMode});
 const [draft,setDraft]=useState<AIServiceConfig>(clean),[provider,setProvider]=useState(identify(kind,service)),[key,setKey]=useState(''),[remember,setRemember]=useState(!!service.remembered),[working,setWorking]=useState(false),[models,setModels]=useState<string[]>([]),[notice,setNotice]=useState('');
 useEffect(()=>{setDraft(clean());setProvider(identify(kind,service));setKey('');setRemember(!!service.remembered);setModels([])},[service.baseUrl,service.model,service.protocol,service.jsonMode,service.remembered]);
 const dirty=JSON.stringify(draft)!==JSON.stringify(clean())||remember!==!!service.remembered||!!key;
 useEffect(()=>{onDirty?.(kind,dirty||working)},[kind,dirty,working]);
 const blocked=disabled||working,chosen=providers.find(p=>p.id===provider),modelOptions=kind==='image'?chosen?.models||[]:[];
 function preset(value:string){const p=providers.find(p=>p.id===value)?.[kind];if(!p)return;setProvider(value);setDraft({...p});setKey('');setRemember(false);setModels([]);setNotice('已选好默认模型，填写这个平台的密钥后点击启用。')}
 async function save(){const bridge=window.shicaiDesktop;if(!bridge||blocked)return;setWorking(true);try{const result=await bridge.aiConfigure({kind,config:draft,remember,...(key.trim()?{key:key.trim()}:{})});if(!result.ok||!result.status)throw Error(result.error||'连接未保存');setKey('');onStatus(result.status);setNotice(result.status.services[kind].connected?(remember?'连接已启用，密钥已由系统加密记住。下次启动可自动恢复。':'连接已启用，本次运行密钥已就绪。可在下方开始创作。'):'设置已保存，请填写密钥后启用。');onMessage('')}catch(e){setNotice(e instanceof Error?e.message:'保存失败')}finally{setWorking(false)}}
 async function clear(){const result=await window.shicaiDesktop?.aiClear(kind);if(result?.ok&&result.status){onStatus(result.status);setKey('');setRemember(false);setNotice('已断开并移除记住的'+label+'密钥。')}else setNotice(result?.error||'断开失败')}
 async function loadModels(){const bridge=window.shicaiDesktop;if(!bridge||blocked)return;setWorking(true);try{const result=await bridge.aiModels(kind);if(!result.ok)throw Error(result.error||'无法读取');setModels(result.models||[]);setNotice(`取得 ${result.models?.length||0} 个模型。列表可能含不支持当前用途的型号。`)}catch(e){setNotice(e instanceof Error?e.message:'请使用已内置的模型选项')}finally{setWorking(false)}}
 return <div className="ai-service-card">
  <h4><KeyRound size={15}/>{label}连接 <span>{service.connected?(service.remembered?'已恢复 / 已记住':'本次已启用'):'未启用'}</span></h4>
  <label>选择平台<select aria-label={label+'服务商'} value={provider} onChange={e=>preset(e.target.value)} disabled={blocked}>{providers.filter(p=>p[kind]).map(p=><option key={p.id} value={p.id}>{kind==='plan'?p.name.split(' · ')[0]:p.name}</option>)}</select></label>
  {modelOptions.length>0&&<label>选择模型<select aria-label={label+'推荐模型'} value={modelOptions.includes(draft.model)?draft.model:'custom'} onChange={e=>e.target.value!=='custom'&&setDraft({...draft,model:e.target.value})} disabled={blocked}>{modelOptions.map(m=><option key={m} value={m}>{names[m]||m}</option>)}{!modelOptions.includes(draft.model)&&<option value="custom">当前自定义模型</option>}</select></label>}
  <p className="ai-service-hint">{chosen?.hint}</p>
  <label>填写平台密钥{chosen?.keyUrl&&<a href={chosen.keyUrl} target="_blank" rel="noreferrer">去官网获取 <ExternalLink size={12}/></a>}<input aria-label={label+' API 密钥'} type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} placeholder={service.connected?'已启用；仅更换密钥时需要填写':'从平台官网复制后粘贴到这里'} disabled={blocked}/></label>
  <label className="ai-remember"><input type="checkbox" checked={remember} disabled={blocked||!status.canRememberKeys} onChange={e=>setRemember(e.target.checked)}/>在这台电脑记住密钥（系统加密）</label>
  {!status.canRememberKeys&&<small>当前系统加密不可用，密钥只在本次运行期间保留。</small>}
  <div className="ai-service-actions"><button className="primary" disabled={blocked||!draft.baseUrl.trim()||!draft.model.trim()||(!service.connected&&!key.trim())} onClick={save}>启用{label}连接</button>{service.connected&&<button className="outline" disabled={blocked} onClick={clear}><Trash2 size={13}/>断开连接</button>}</div>
  <details className="ai-advanced" open={provider==='custom'?true:undefined}><summary>高级设置（通常不用改）</summary>
   <label>服务地址<input aria-label={label+'服务地址'} type="url" value={draft.baseUrl} onChange={e=>setDraft({...draft,baseUrl:e.target.value})} disabled={blocked} spellCheck={false}/></label>
   <label>模型 ID<input aria-label={label+'模型名称'} list={'ai-models-'+kind} value={draft.model} onChange={e=>setDraft({...draft,model:e.target.value})} disabled={blocked} spellCheck={false}/><datalist id={'ai-models-'+kind}>{models.map(m=><option key={m} value={m}/>)}</datalist></label>
   <label>接口类型<select aria-label={label+'接口类型'} value={draft.protocol} onChange={e=>setDraft({...draft,protocol:e.target.value as AIServiceConfig['protocol']})} disabled={blocked}>{Object.entries(protocols).filter(([id])=>kind==='plan'?['chat','responses'].includes(id):!['chat','responses'].includes(id)).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   {kind==='plan'&&<label>方案格式<select value={draft.jsonMode} aria-label="方案输出格式" onChange={e=>setDraft({...draft,jsonMode:e.target.value as AIServiceConfig['jsonMode']})} disabled={blocked}><option value="prompt">自动按提示词整理</option><option value="json">JSON 模式</option><option value="schema">严格 JSON Schema</option></select></label>}
   <button className="outline" disabled={blocked||dirty||!service.connected} onClick={loadModels}>读取更多模型</button>
  </details>
  <small>启用会保存连接，不会发起付费生成。勾选记住后，下次自动恢复的是连接配置，余额与模型权限仍以平台为准。</small>
  {dirty&&<p className="ai-service-hint">改动尚未启用，请先点击上方“启用{label}连接”。</p>}
  {notice&&<p className="ai-service-hint" role="status">{notice}</p>}
 </div>
}
