import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseBingImages,bingSearch} from './app/lib/assets.mjs';
import {GET as search} from './app/api/search/route.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(root,'desktop/.search-check-'));
const originalFetch=globalThis.fetch;
const card=(name,extra={})=>'<a class="iusc" m="'+JSON.stringify({murl:`https://images.testcdn.com/${name}.jpg`,purl:`https://www.testcdn.com/${name}`,turl:`https://thumbs.testcdn.com/${name}.jpg`,t:'A & B',...extra}).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></a>';
try{
  const parsed=parseBingImages(card('one')+card('one')+card('private',{murl:'http://127.0.0.1/secret'})+card('credentials',{murl:'https://user:pass@testcdn.com/x'}));
  assert.equal(parsed.length,1);assert.equal(parsed[0].title,'A & B');assert.equal(parsed[0].license,'授权见来源页');
  let count=0;
  globalThis.fetch=async url=>{const q=new URL(url).searchParams.get('q');const n=count++;if(q?.endsWith(' 摄影'))throw Error('one source failed');return new Response(Array.from({length:35},(_,i)=>card(`${n}-${i}`)).join(''))};
  const r=await search(new Request('http://127.0.0.1:9999/api/search?q=森林&source=bing&page=1'));
  const data=await r.json();assert.equal(r.status,200);assert.equal(data.items.length,70,'more than 24 real upstream results survive aggregation');assert.equal(data.sources[0].queries.length,3);assert.equal(data.more,true);
  const next=await bingSearch('森林',2);assert.ok(next.queries.includes('森林 实拍'));assert.ok(next.items.length>24);
  assert.equal((await search(new Request('http://127.0.0.1:9999/api/search?q=x&source=bing&page=11'))).status,400);
  globalThis.fetch=async()=>new Response('verify you are human captcha');await assert.rejects(bingSearch('x',1),/人工验证/);
  for(const name of ['quality','crypto','image-bytes','workbench','search-sites']){
    let code=ts.transpile(fs.readFileSync(path.join(root,'app/lib',name+'.ts'),'utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
    code=code.replace(/(from\s+['"])(\.[^'"]+)(['"])/g,(_,a,b,c)=>a+b+'.mjs'+c);fs.writeFileSync(path.join(dir,name+'.mjs'),code);
  }
  const {mediaUrl}=await import(pathToFileURL(path.join(dir,'quality.mjs')).href);
  const {normalizeAssets}=await import(pathToFileURL(path.join(dir,'workbench.mjs')).href);
  const {searchSites,websiteUrl}=await import(pathToFileURL(path.join(dir,'search-sites.mjs')).href);
  const a=normalizeAssets(parsed)[0];assert.equal(a.thumbnail,parsed[0].thumbnail);
  assert.equal(new URL(mediaUrl(a),'http://localhost').searchParams.get('url'),a.thumbnail);
  assert.equal(new URL(mediaUrl(a,true),'http://localhost').searchParams.get('url'),a.url,'saving must request original, never thumbnail');
  assert.equal(searchSites.length,47);assert.equal(new Set(searchSites.map(s=>s.name)).size,47);
  for(const site of searchSites){assert.equal(new URL(site.url).protocol,'https:');const target=new URL(websiteUrl(site,'植物 & paper'));assert.ok(['https:','http:'].includes(target.protocol));assert.ok(!target.username&&!target.password)}
  for(const name of ['百度图片','搜狗图片','360 图片','Wikimedia Commons','Openverse','芝加哥艺术博物馆'])assert.ok(searchSites.some(s=>s.name===name));
  console.log(JSON.stringify({passed:true,checks:['real result metadata and deduplication','private URL rejection','partial network failure','70 results retained','related-query load more','human-verification error','original bytes separate from thumbnails','47 website entries and safe keyword encoding']}));
}finally{globalThis.fetch=originalFetch;fs.rmSync(dir,{recursive:true,force:true})}
