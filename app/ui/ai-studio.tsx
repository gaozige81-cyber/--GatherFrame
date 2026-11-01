'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {WandSparkles,Search,Download,ImagePlus,KeyRound,Trash2,RefreshCw} from 'lucide-react';
import type {Asset} from '../lib/assets';
import {normalizeAssets} from '../lib/workbench';
import {saveBlob,saveMessage} from '../lib/save';
import {safeFileName,type AIStatus} from '../lib/preferences';
import {AIConnection} from './ai-connection';
import {AIWebStudio} from './ai-web-studio';

type Slot={role:string;description:string;query:string;requirements:string;generatePrompt:string};
type Plan={title:string;concept:string;palette:string[];layout:string[];slots:Slot[]};
type ImageResult={data:Uint8Array;mime:string;prompt:string};
export default function AIStudio({projectName,assets,onCandidates,onSearch,onProcess}:{projectName:string;assets:Asset[];onCandidates:(a:Asset[])=>void;onSearch:(q:string)=>void;onProcess:(f:File)=>void}){
 const [desktop,setDesktop]=useState(false),[status,setStatus]=useState<AIStatus|null>(null),[brief,setBrief]=useState(''),[plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[image,setImage]=useState<ImageResult|null>(null),[preview,setPreview]=useState(''),[prompt,setPrompt]=useState(''),[size,setSize]=useState('1024x1536'),[transparent,setTransparent]=useState(false);
 const [entry,setEntry]=useState<'web'|'api'>('web'),[pending,setPending]=useState({plan:false,image:false});
 const onDirty=useCallback((kind:'plan'|'image',value:boolean)=>setPending(old=>old[kind]===value?old:{...old,[kind]:value}),[]);
 const latest=useRef(0);
 useEffect(()=>{window.scrollTo(0,0)},[entry]);
 useEffect(()=>{const bridge=window.shicaiDesktop;if(!bridge)return;setDesktop(true);bridge.aiStatus().then(setStatus).catch(()=>setMessage('AI 状态读取失败，请重开应用。'))},[]);
 useEffect(()=>{if(!image)return;const u=URL.createObjectURL(new Blob([image.data as BlobPart],{type:image.mime}));setPreview(u);return()=>URL.revokeObjectURL(u)},[image]);
 const bridge=typeof window!=='undefined'?window.shicaiDesktop:undefined;
 async function makePlan(){if(!bridge||busy)return;setBusy('plan');setMessage('正在拆解海报需求…');setPlan(null);setImage(null);const token=++latest.current;try{const result=await bridge.aiPlan({brief,assets:assets.slice(0,12).map(a=>({title:a.title,width:a.width,height:a.height,format:a.format,license:a.license,page:a.page}))});if(token!==latest.current)return;if(!result.ok||!result.plan)throw Error(result.error||'策划失败');setPlan(result.plan);setPrompt(result.plan.slots[0]?.generatePrompt||'');setMessage('方案已生成。你可以逐类找真实素材，或对缺少的元素单独生图。')}catch(e){setMessage(e instanceof Error?e.message:'策划失败')}finally{if(token===latest.current)setBusy('')}}
 async function findAll(){if(!plan||busy)return;setBusy('find');setMessage('正在根据素材清单检索公开图库…');let successful=0,failed=0;const found:Asset[]=[];
  for(const slot of plan.slots.slice(0,3)){try{const r=await fetch('/api/search?'+new URLSearchParams({q:slot.query,page:'1',source:'all'}));const d:any=await r.json();if(!r.ok)throw Error();found.push(...normalizeAssets(d.items).slice(0,3));successful++}catch{failed++}}
  if(found.length)onCandidates(found);setBusy('');setMessage(found.length?`从${successful}类需求找到${found.length}张真实候选并加入收集箱；请再检测原图和授权。${failed?'另有'+failed+'类未连接。':''}`:'没有取得可用候选，请换关键词、来源或稍后重试。');
 }
 async function generate(){if(!bridge||busy)return;setBusy('image');setMessage('正在向已保存的生图服务请求一张素材，请稍候…');setImage(null);try{const r=await bridge.aiImage({prompt,size,transparent:transparent&&status?.services.image.protocol==='openai-image'});if(!r.ok||!r.image)throw Error(r.error||'生图失败');setImage(r.image);setMessage('图片已生成。请先预览，再保存或送去本地处理。')}catch(e){setMessage(e instanceof Error?e.message:'生图失败')}finally{setBusy('')}}
 async function save(){if(!image||busy)return;setBusy('save');try{setMessage(saveMessage(await saveBlob(new Blob([image.data as BlobPart],{type:image.mime}),safeFileName(projectName+'-AI素材',image.mime==='image/jpeg'?'jpg':image.mime==='image/webp'?'webp':'png'))))}catch{setMessage('图片保存失败，请重试。')}finally{setBusy('')}}
 function process(){if(!image)return;onProcess(new File([image.data as BlobPart],safeFileName(projectName+'-AI素材',image.mime==='image/jpeg'?'jpg':image.mime==='image/webp'?'webp':'png'),{type:image.mime}));setMessage('图片已送去本地处理，可继续转为其他格式。')}
 return <section className="ai-studio">
  <div className="ai-intro"><WandSparkles size={24}/><div><h2>从一句想法开始创作</h2><p>不懂 API 也能用：整理需求、打开平台官网，再把生成的图片带回拾材处理。</p></div></div>
  <div className="ai-entry-tabs" role="tablist" aria-label="AI 使用方式"><button role="tab" aria-selected={entry==='web'} disabled={!!busy} onClick={()=>setEntry('web')}>免配置 · 打开官网创作</button><button role="tab" aria-selected={entry==='api'} disabled={!!busy} onClick={()=>setEntry('api')}>在拾材内生成 · 连接平台</button></div>
  <div hidden={entry!=='web'}><AIWebStudio brief={brief} onBrief={setBrief} onProcess={onProcess}/></div>
  <div hidden={entry!=='api'}>
  {!desktop?<div className="ai-box"><h3>在桌面版使用内置 AI</h3><p>桌面版可使用你自己的 OpenAI、DeepSeek、通义千问或其他兼容服务的 API。网页端继续使用收集箱、图库与图片转换；安装包可从本项目交付页下载。</p></div>:<>
   <div className="ai-box"><h3><KeyRound size={17}/>模型连接</h3><p>选择平台，粘贴自己的密钥即可启用，地址和接口由拾材自动填写。策划和生图可使用不同平台；选择系统加密记住后，下次可自动恢复。调用按各平台账户计费。</p>{status?<div className="ai-service-grid"><AIConnection kind="plan" status={status} disabled={!!busy||status.busy} onStatus={setStatus} onMessage={setMessage} onDirty={onDirty}/><AIConnection kind="image" status={status} disabled={!!busy||status.busy} onStatus={setStatus} onMessage={setMessage} onDirty={onDirty}/></div>:<p>正在读取模型设置…</p>}</div>
   {(pending.plan||pending.image)&&<p className="ai-service-hint">连接改动尚未启用，请先完成上方连接设置。</p>}
   <div className="ai-box"><h3>01 描述海报</h3><textarea aria-label="海报需求" value={brief} onChange={e=>setBrief(e.target.value)} maxLength={2000} placeholder="例如：A3 竖版《自然越界》，复古印刷拼贴，机械植物从破损电视里生长，深绿、锈红、米白，主标题在顶部，底部留说明文字。"/><div className="ai-actions"><span>只发送这段描述与最多 12 张当前素材的标题、格式、尺寸和来源信息。</span><button className="primary" disabled={!status?.services.plan.connected||pending.plan||pending.image||!!busy||brief.trim().length<8} onClick={makePlan}><WandSparkles size={16}/>{busy==='plan'?'正在策划…':'生成素材与排版方案'}</button></div></div>
   {plan&&<div className="ai-box"><h3>02 {plan.title}</h3><p>{plan.concept}</p><div className="ai-palette">{plan.palette.map((color,i)=><span key={i}>{color}</span>)}</div><div className="ai-slot-list">{plan.slots.map((slot,i)=><article key={i}><div><b>{String(i+1).padStart(2,'0')} · {slot.role}</b><p>{slot.description}</p><small>{slot.requirements}</small></div><button className="outline" onClick={()=>onSearch(slot.query)} disabled={!!busy}><Search size={14}/>找这一类</button><button className="outline" onClick={()=>{setPrompt(slot.generatePrompt);setTransparent(status?.services.image.protocol==='openai-image'&&/主体|装饰|元素|图标/.test(slot.role))}} disabled={!!busy}><ImagePlus size={14}/>生这一类</button></article>)}</div><div className="ai-actions"><span>AI 给的是搜索建议；候选仍需检查清晰度、透明像素和授权。</span><button className="primary" disabled={!!busy} onClick={findAll}><Search size={15}/>{busy==='find'?'正在找素材…':'自动找前三类候选'}</button></div><div className="ai-layout"><h4>拼贴与排版步骤</h4><ol>{plan.layout.map((step,i)=><li key={i}>{step}</li>)}</ol></div></div>}
   <div className="ai-box"><h3>03 生成缺少的素材</h3><p>一次生成一张可复用图片。返回格式以服务商结果为准；比例和透明背景能力因模型而异。仅有文字策划服务时，仍可生成方案并寻找真实素材。</p><textarea aria-label="生图描述" maxLength={3000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="单独描述一张背景或主体素材…"/><div className="ai-options"><label>比例<select aria-label="生成比例" value={size} onChange={e=>setSize(e.target.value)}><option value="1024x1536">竖版</option><option value="1536x1024">横版</option><option value="1024x1024">方形</option></select></label><label><input type="checkbox" checked={transparent&&status?.services.image.protocol==='openai-image'} disabled={!!busy||status?.services.image.protocol!=='openai-image'} onChange={e=>setTransparent(e.target.checked)}/>透明背景（需模型支持）</label><button className="primary" disabled={!status?.services.image.connected||pending.image||pending.plan||!!busy||prompt.trim().length<8} onClick={generate}><WandSparkles size={16}/>{busy==='image'?'生成中…':'生成图片'}</button></div>{preview&&image&&<div className="ai-result"><img src={preview} alt="AI 生成图片预览"/><div><button className="primary" onClick={save} disabled={!!busy}><Download size={15}/>保存 {image.mime==='image/jpeg'?'JPG':image.mime==='image/webp'?'WebP':'PNG'}</button><button className="outline" onClick={process} disabled={!!busy}><RefreshCw size={15}/>送去格式处理</button></div></div>}</div>
  </>}{message&&<div className="ai-message" role="status">{message}</div>}</div>
 </section>
}
