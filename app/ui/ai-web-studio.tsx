'use client';
import {useMemo,useRef,useState} from 'react';
import {ExternalLink,Copy,ImagePlus} from 'lucide-react';
import catalog from '../../desktop/app/ai-catalog.json';
export function AIWebStudio({brief,onBrief,onProcess}:{brief:string;onBrief:(s:string)=>void;onProcess:(f:File)=>void}){
 const [style,setStyle]=useState('简约平面'),[purpose,setPurpose]=useState('完整海报'),[ratio,setRatio]=useState('竖版 2:3'),[notice,setNotice]=useState('');const file=useRef<HTMLInputElement>(null);
 const prompt=useMemo(()=>brief.trim()?`请创作一张${ratio}的${purpose}，视觉风格为${style}。\n创作需求：${brief.trim()}\n${purpose==='完整海报'?'主视觉清晰，主体层次明确，预留标题和说明文字的位置；需要显示的文字严格按需求原文生成。':'只生成可复用的单张素材，保持边缘清晰，不额外添加标题、说明文字或排版。'}\n请直接生成图片。`:'',[brief,style,purpose,ratio]);
 function open(event:import('react').MouseEvent<HTMLAnchorElement>,id:string){
  const bridge=window.shicaiDesktop;
  if(bridge?.aiOpenWeb){event.preventDefault();void bridge.aiOpenWeb({id,prompt}).then(result=>setNotice(result.ok?(result.copied?'提示词已复制，官网已打开。请在官网粘贴后生成。':'官网已打开，可用自己的账号登录创作。'):result.error||'官网未能打开')).catch(()=>setNotice('官网未能打开，请稍后重试。'))}else copy();
 }
 function copy(){if(!prompt)return;void navigator.clipboard.writeText(prompt).then(()=>setNotice('提示词已复制，到官网粘贴即可。')).catch(()=>setNotice('未能复制，请手动选中下方提示词复制。'))}
 return <div className="ai-web-studio">
  <div className="ai-box"><h3>01 写下想做的画面</h3><p>不用填写 API。先描述需求，再选平台官网，用自己的账号登录、粘贴提示词并生成。是否收费、是否有免费额度由各平台决定。</p><textarea aria-label="免配置创作需求" value={brief} onChange={e=>onBrief(e.target.value)} maxLength={2000} placeholder="例如：为校园旧物市集做一张复古拼贴海报，米白底色、绿植与旧相机，顶部留出活动名称的位置。"/>
   <div className="ai-web-options"><label>想做什么<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option>完整海报</option><option>背景素材</option><option>单独主体</option><option>装饰元素</option></select></label><label>风格<select value={style} onChange={e=>setStyle(e.target.value)}>{['简约平面','复古拼贴','自然摄影','国风插画','3D 立体'].map(s=><option key={s}>{s}</option>)}</select></label><label>比例<select value={ratio} onChange={e=>setRatio(e.target.value)}><option>竖版 2:3</option><option>横版 3:2</option><option>方形 1:1</option></select></label></div>
   <details><summary>查看整理后的提示词（本地模板）</summary><textarea aria-label="整理后的提示词" readOnly value={prompt} placeholder="填写需求后，这里会自动整理提示词。"/><button className="outline" onClick={copy} disabled={!prompt}><Copy size={14}/>复制提示词</button></details>
  </div>
  <div className="ai-box"><h3>02 选择一个平台开始创作</h3><p>点击后会复制提示词并打开浏览器。登录、粘贴和生成由你在官网完成，拾材不会读取网页登录状态或自动扣费。</p><div className="ai-web-grid">{catalog.web.map(site=><article className="ai-web-card" key={site.id}><b>{site.name}</b><span>{site.description}</span><a className="outline" href={site.url} target="_blank" rel="noreferrer" onClick={e=>open(e,site.id)}><ExternalLink size={14}/>{prompt?'复制并打开官网':'打开官网'}</a></article>)}</div></div>
  <div className="ai-box ai-bring-back"><div><h3>03 把生成的图片带回拾材</h3><p>在官网保存图片后，导入拾材继续转换格式、调整尺寸和整理交付。</p></div><button className="primary" onClick={()=>file.current?.click()}><ImagePlus size={16}/>导入生成图片</button><input ref={file} hidden type="file" accept="image/*" onChange={e=>{const chosen=e.target.files?.[0];if(chosen)onProcess(chosen);e.target.value=''}}/></div>
  {notice&&<div className="ai-message" role="status">{notice}</div>}
 </div>
}
