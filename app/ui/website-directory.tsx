'use client';
import {useState} from 'react';
import {Search,ArrowUpRight,Link as LinkIcon} from 'lucide-react';
import {searchSites,websiteUrl} from '../lib/search-sites';
export default function WebsiteDirectory({keyword,onKeyword,onImport,custom}:{keyword:string;onKeyword:(value:string)=>void;onImport:()=>void;custom:string}){
  const [group,setGroup]=useState('全部'),[filter,setFilter]=useState('');
  const sites=custom?[...searchSites,{name:'自定义网站',group:'自定义',description:'你在偏好设置中保存的入口',url:custom.replaceAll('{query}',''),search:custom}]:searchSites;
  const shown=sites.filter(site=>(group==='全部'||site.group===group)&&[site.name,site.description,site.group].join(' ').toLowerCase().includes(filter.trim().toLowerCase()));
  return <section className="website-directory">
    <div className="directory-search"><label><Search size={20}/><input aria-label="网站搜图关键词" placeholder="关键词会带到支持站内搜索的网站" value={keyword} maxLength={180} onChange={e=>onKeyword(e.target.value)}/></label><button className="outline" onClick={onImport}><LinkIcon size={16}/>从来源页导入图片</button></div>
    <div className="directory-tools"><div className="directory-categories">{['全部',...new Set(sites.map(site=>site.group))].map(name=><button key={name} className={group===name?'active':''} onClick={()=>setGroup(name)}>{name}</button>)}</div><input aria-label="筛选网站" placeholder="筛选网站名称或类型" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
    <p className="directory-count">{shown.length} 个网站 · 在默认浏览器中打开，应用内找图请点击左侧“寻找图片”。</p>
    <div className="website-grid">{shown.map(site=><article key={site.name}><span className="website-category">{site.group}</span><h2>{site.name}</h2><p>{site.description}</p><div><a href={websiteUrl(site,keyword)} target="_blank" rel="noreferrer">{site.search&&keyword.trim()?'搜索关键词':'打开网站'}<ArrowUpRight size={15}/></a>{site.search&&keyword.trim()&&<a className="website-home" href={site.url} target="_blank" rel="noreferrer">首页</a>}</div></article>)}</div>
    {!shown.length&&<div className="empty"><Search size={30}/><h3>没有匹配的网站</h3><button className="outline" onClick={()=>{setGroup('全部');setFilter('')}}>显示全部网站</button></div>}
  </section>
}
