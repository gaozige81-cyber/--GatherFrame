import {publicUrl} from './public-fetch';
import {readLimited} from './image-bytes';
export type Asset = {id:string; source:string; title:string; creator:string; width:number; height:number; format:string; license:string; licenseUrl:string; page:string; attribution:string; url?:string; thumbnail?:string};
export const clean=(value:unknown)=>String(value??'').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'").trim();
export function httpUrl(value:unknown){try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
export async function jsonFetch(url:string):Promise<any>{const r=await fetch(url,{headers:{'User-Agent':'ShiCaiAssetFinder/1.0 (image discovery; contact via source site)'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`来源响应 ${r.status}`);return r.json()}
export function wikiAsset(p:any):Asset|null {const i=p.imageinfo?.[0];if(!i || !['image/jpeg','image/png','image/webp','image/gif'].includes(i.mime))return null;const m=i.extmetadata||{};const title=clean(m.ObjectName?.value||p.title.replace(/^File:/,''));const creator=clean(m.Artist?.value||m.Credit?.value||'作者见来源页').slice(0,300);const license=clean(m.LicenseShortName?.value||'需核验授权');return {id:String(p.pageid),source:'commons',title,creator,width:i.width||0,height:i.height||0,format:i.mime.split('/')[1].toUpperCase().replace('JPEG','JPG'),license,licenseUrl:httpUrl(m.LicenseUrl?.value),page:httpUrl(i.descriptionurl),attribution:`${title} — ${creator} · ${license} · ${i.descriptionurl}`}}
export async function wikiSearch(q:string,page:number){const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'24',gsroffset:String((page-1)*24),prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiurlwidth:'640'}).toString();const d=await jsonFetch(u.href);if(d.error)throw new Error('公共图库暂时无法检索');return {items:Object.values(d.query?.pages||{}).sort((a:any,b:any)=>a.index-b.index).map(wikiAsset).filter(Boolean),more:!!d.continue}}
export async function openSearch(q:string,page:number){const u=new URL('https://api.openverse.org/v1/images/');u.search=new URLSearchParams({q,page:String(page),page_size:'24',mature:'false'}).toString();const d=await jsonFetch(u.href);return {items:(d.results||[]).map((i:any)=>({id:i.id,source:'openverse',title:clean(i.title),creator:clean(i.creator||'作者见来源页'),width:i.width||0,height:i.height||0,format:String(i.filetype||'IMAGE').toUpperCase(),license:`CC ${i.license?.toUpperCase()} ${i.license_version||''}`,licenseUrl:httpUrl(i.license_url),page:httpUrl(i.foreign_landing_url),attribution:clean(i.attribution||`${i.title} — ${i.creator} · ${i.license_url}`)})),more:!!d.next}}

export async function artSearch(q:string,page:number){const u=new URL('https://api.artic.edu/api/v1/artworks/search');u.search=new URLSearchParams({q,page:String(page),limit:'24','query[bool][must][0][term][is_public_domain]':'true','query[bool][must][1][multi_match][query]':q,'query[bool][must][1][multi_match][fields][0]':'title',fields:'id,title,artist_display,image_id,is_public_domain,thumbnail'}).toString();const d=await jsonFetch(u.href);return{items:(d.data||[]).filter((a:any)=>a.is_public_domain&&a.image_id).map((a:any)=>({id:String(a.id),source:'artic',title:clean(a.title),creator:clean(a.artist_display),width:0,height:0,format:'JPG',license:'CC0 · 公有领域',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',page:'https://www.artic.edu/artworks/'+a.id,attribution:clean(a.title)+' — '+clean(a.artist_display)+' · Art Institute of Chicago · CC0'})),more:page<(d.pagination?.total_pages||1)}}

function decodeAttribute(value:string){return value.replace(/&(?:quot|amp|lt|gt|apos|#\d+|#x[\da-f]+);/gi,entity=>{const named:Record<string,string>={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&apos;':"'"};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];const code=entity.toLowerCase().startsWith('&#x')?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));return code>0&&code<=0x10ffff?String.fromCodePoint(code):''})}
export function parseBingImages(html:string){const items:Asset[]=[],seen=new Set<string>();for(const match of html.matchAll(/<a\b([^>]+)>/gi)){const attrs:Record<string,string>={};for(const attr of match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[attr[1].toLowerCase()]=decodeAttribute(attr[2]??attr[3]);if(!attrs.class?.split(/\s+/).includes('iusc')||!attrs.m)continue;try{const m=JSON.parse(attrs.m),url=publicUrl(m.murl).href,page=publicUrl(m.purl).href;if(seen.has(url))continue;seen.add(url);let thumbnail='';try{thumbnail=publicUrl(m.turl).href}catch{}const title=clean(m.t||new URL(page).hostname).slice(0,180),id=/^[a-f\d]{32}$/i.test(m.md5||'')?m.md5:String(items.length);items.push({id:'bing-'+id,source:'web',url,...(thumbnail?{thumbnail}:{}),title,creator:new URL(page).hostname,width:0,height:0,format:'待检测',license:'授权见来源页',licenseUrl:'',page,attribution:title+' · '+page});}catch{}}return items}
// The public search page may repeat results for numeric offsets. Expand actual
// queries explicitly instead of presenting duplicate batches as new images.
export const bingQueryBatches = [
  ['', ' 高清照片', ' 摄影'],
  [' 实拍', ' 背景图片', ' 壁纸'],
  [' 图片', ' 高清大图', ' 背景'],
  [' 照片', ' 图片素材', ' 高清壁纸'],
  [' 摄影作品', ' 高清摄影', ' 摄影图片'],
  [' 细节', ' 特写', ' 近景'],
  [' 全景', ' 远景', ' 局部'],
  [' 横版', ' 竖版', ' 横屏壁纸'],
  [' 自然光', ' 创意摄影', ' 氛围'],
  [' 设计参考', ' 构图', ' 灵感']
];

async function bingQuery(q:string){
  const u=new URL('https://www.bing.com/images/search');u.search=new URLSearchParams({q,adlt:'strict'}).toString();
  const r=await fetch(u.href,{headers:{'User-Agent':'ShiCai/2.2.1 (image discovery)','Accept':'text/html','Accept-Language':'zh-CN,zh;q=0.9,en;q=0.8'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error(`图片搜索暂时不可用（${r.status}）`);
  const html=new TextDecoder().decode(await readLimited(r,4*1024*1024)),items=parseBingImages(html);
  if(!items.length&&/captcha|unusual traffic|verify you are human/i.test(html))throw Error('搜索网站要求人工验证，请使用网站目录在浏览器打开');
  return items;
}
export async function bingSearch(q:string,page:number){
  const batch=bingQueryBatches[page-1];if(!batch)return{items:[],more:false,queries:[]};
  const queries=batch.map(suffix=>q+suffix),results=await Promise.allSettled(queries.map(bingQuery));
  const success=results.filter((r):r is PromiseFulfilledResult<Asset[]>=>r.status==='fulfilled');
  if(!success.length)throw (results[0] as PromiseRejectedResult).reason;
  const seen=new Set<string>(),items:Asset[]=[];
  for(let n=0;n<80;n++)for(const result of success){const a=result.value[n];if(a?.url&&!seen.has(a.url)){seen.add(a.url);items.push(a)}}
  return{items:items.slice(0,120),more:page<bingQueryBatches.length,queries};
}
