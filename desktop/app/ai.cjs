// Credentials stay in this trusted main-process instance and are never serialized.
const {isIP}=require('node:net');
const {publicIP,safeFetch}=require('./safe-network.cjs');
const schema={type:'object',additionalProperties:false,required:['title','concept','palette','layout','slots'],properties:{title:{type:'string'},concept:{type:'string'},palette:{type:'array',items:{type:'string'}},layout:{type:'array',items:{type:'string'}},slots:{type:'array',items:{type:'object',additionalProperties:false,required:['role','description','query','requirements','generatePrompt'],properties:{role:{type:'string'},description:{type:'string'},query:{type:'string'},requirements:{type:'string'},generatePrompt:{type:'string'}}}}}};
const defaults={plan:{baseUrl:'https://api.openai.com/v1/',model:'gpt-4.1-mini',protocol:'responses',jsonMode:'schema'},image:{baseUrl:'https://api.openai.com/v1/',model:'gpt-image-2.5-flare',protocol:'openai-image',jsonMode:'prompt'}};
const clipped=(s,max)=>String(s||'').trim().slice(0,max);
function publicError(e){const message=String(e?.message||'');return /^(请先|请输入|另一个 AI|AI|无法连接 AI|当前 API|当前生图|接口额度|API 密钥|生成结果|服务|模型|配置|图片)/.test(message)&&message.length<240?message:'AI 任务未完成，请检查连接后重试。'}
function publicUrl(value){
 let u;try{u=new URL(String(value||'').trim())}catch{throw Error('服务地址格式不正确，请填写 HTTPS 地址。')}
 const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,'').replace(/\.$/,'');
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||!host.includes('.')&&!host.includes(':')||host==='localhost'||/\.(local|internal|localhost|test|invalid|example|onion)$/.test(host)||isIP(host)&&!publicIP(host))throw Error('服务地址必须是公开的 HTTPS 地址，不能带账号、查询参数或指向本机、内网。');
 return u;
}
function serviceConfig(kind,raw){
 if(!['plan','image'].includes(kind)||!raw||typeof raw!=='object')throw Error('配置无效，请重新选择服务。');
 const u=publicUrl(raw.baseUrl);if(u.href.length>1000)throw Error('服务地址过长。');
 // Accept either a base URL or the commonly pasted full API endpoint.
 u.pathname=u.pathname.replace(/\/(?:chat\/completions|responses|images\/generations|models)\/?$/,'').replace(/\/+$/,'')+'/';
 const model=String(raw.model||'').trim();if(model.length>160||!/^[-A-Za-z0-9_.:/@+]+$/.test(model))throw Error('模型名称不能为空，请填写服务商提供的模型 ID。');
 const allowed=kind==='plan'?['responses','chat']:['openai-image','compatible-image','siliconflow-image','gemini-image','seedream-image','bfl-image','ideogram-image','stability-image','grok-image'];
 if(!allowed.includes(raw.protocol))throw Error('配置的接口类型不支持。');
 const jsonMode=kind==='plan'&&['prompt','json','schema'].includes(raw.jsonMode)?raw.jsonMode:'prompt';
 return {baseUrl:u.href,model,protocol:raw.protocol,jsonMode};
}
function normalizePlan(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.slots)||!data.slots.length||!Array.isArray(data.layout))throw Error('AI返回的方案无法使用，请重试。');
 const strings=(v,n,m)=>Array.isArray(v)?v.slice(0,n).map(x=>clipped(x,m)).filter(Boolean):[];
 const slots=data.slots.slice(0,5).filter(x=>x&&typeof x==='object').map(x=>({role:clipped(x.role,60),description:clipped(x.description,250),query:clipped(x.query,100),requirements:clipped(x.requirements,220),generatePrompt:clipped(x.generatePrompt,1000)})).filter(x=>x.role&&x.query);
 if(!slots.length)throw Error('AI返回的方案无法使用，请重试。');
 return{title:clipped(data.title,80),concept:clipped(data.concept,650),palette:strings(data.palette,6,70),layout:strings(data.layout,8,250),slots};
}
function parsePlan(text){
 if(typeof text!=='string'||text.length>500000)throw Error('AI 未返回完整方案，请重试。');
 const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return normalizePlan(JSON.parse(clean))}catch(e){if(e instanceof SyntaxError)throw Error('AI返回的方案不是有效 JSON，可在模型设置中切换输出格式后重试。');throw e}
}
async function limitedBody(response,cap){
 if(Number(response.headers.get('content-length')||0)>cap){await response.body?.cancel();throw Error('AI返回的内容超过大小限制。')}
 const reader=response.body?.getReader();if(!reader)throw Error('AI 未返回内容。');const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>cap)throw Error('AI返回的内容超过大小限制。');chunks.push(Buffer.from(value))}}catch(e){await reader.cancel().catch(()=>{});throw e}
 return Buffer.concat(chunks,total);
}
function checkedImage(bytes){
 let mime='',extension='';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';extension='png'}
 else if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';extension='jpg'}
 else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'){mime='image/webp';extension='webp'}
 if(!mime||bytes.length>15*1024*1024)throw Error('生成结果不是有效的 PNG / JPG / WebP 图片。');
 return{data:new Uint8Array(bytes),mime,extension};
}
const instructions='你是面向 Photoshop 拼贴海报的设计策划助手。输出可执行的素材槽位与排版顺序。搜索词要具体，尽量用英文。只能根据用户提供的素材元数据说已有素材，不要虚构链接、图片、授权或透明属性。生成图提示词应只描述单个可复用素材，避免在图内生成文字。中文输出。仅返回 JSON 对象，不要 Markdown、解释或思考过程。JSON 格式：{"title":"海报标题","concept":"概念","palette":["颜色"],"layout":["图层与排版步骤"],"slots":[{"role":"素材角色","description":"描述","query":"英文搜索词","requirements":"尺寸等要求","generatePrompt":"单张素材生图提示词"}]}，slots 为 1–5 项。';
function createAI(fetcher=globalThis.fetch,options={}){
 let config=JSON.parse(JSON.stringify(defaults)),keys={plan:'',image:''},busy=false;
 try{const stored=options.readConfig?.();for(const kind of ['plan','image']){if(stored?.[kind])config[kind]=serviceConfig(kind,stored[kind])}}catch{}
 const vault=options.credentialStore;
 // Only the retired official OpenAI default is migrated; custom gateway models stay unchanged.
 if(config.image.baseUrl==='https://api.openai.com/v1/'&&config.image.model==='gpt-image-1')config.image.model='gpt-image-2.5-flare';
 for(const kind of ['plan','image']){const saved=vault?.get(kind,config[kind]);if(typeof saved==='string'&&/^[\x21-\x7e]{8,512}$/.test(saved))keys[kind]=saved}
 const fetchImage=options.fetchImage||safeFetch;
 const wait=options.wait||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const validKey=value=>typeof value==='string'&&/^[\x21-\x7e]{8,512}$/.test(value.trim());
 function status(){return{connected:!!keys.plan,busy,canRememberKeys:!!vault?.available(),services:{plan:{...config.plan,connected:!!keys.plan,remembered:!!vault?.has('plan',config.plan)},image:{...config.image,connected:!!keys.image,remembered:!!vault?.has('image',config.image)}}}}
 function configure(kind,raw,key,remember){
  if(busy)return{ok:false,error:'另一个 AI 任务仍在进行，请稍后。'};
  try{
   const next=serviceConfig(kind,raw);if(key!==undefined&&key!==''&&!validKey(key))throw Error('API 密钥格式不正确，请粘贴服务商提供的完整密钥。');
   const updated={...config,[kind]:next},previous=vault?.snapshot();
   const candidate=key?.trim()||(next.baseUrl===config[kind].baseUrl&&next.protocol===config[kind].protocol?keys[kind]:'');
   if(remember===true&&!candidate)throw Error('请先填写密钥，再选择记住连接。');
   try{
    if(remember===true){if(!vault)throw Error('配置未保存：此环境不支持系统加密。');vault.save(kind,next,candidate)}
    else if(remember===false||next.baseUrl!==config[kind].baseUrl||next.protocol!==config[kind].protocol)vault?.forget(kind);
    options.writeConfig?.(updated);
   }catch(e){if(vault&&previous)try{vault.restore(previous)}catch{}throw e}
   keys[kind]=candidate;config=updated;return{ok:true,status:status()};
  }catch(e){return{ok:false,error:publicError(e)}}
 }
 async function request(kind,route,body,timeout,method='POST',extra={}){
  if(!keys[kind])throw Error('请先配置'+(kind==='plan'?'策划':'生图')+'服务并填写 API 密钥。');
  if(busy&&!extra.internal)throw Error('另一个 AI 任务仍在进行，请稍后。');if(!extra.internal)busy=true;
  const service={...config[kind]},key=keys[kind],signal=AbortSignal.timeout(timeout);
  try{
   const auth=service.protocol==='gemini-image'?{'x-goog-api-key':key}:service.protocol==='bfl-image'?{'x-key':key}:service.protocol==='ideogram-image'?{'Api-Key':key}:{Authorization:`Bearer ${key}`};
   const headers={...auth,...(!extra.form?{'Content-Type':'application/json'}:{}),...(extra.binary?{Accept:'image/*'}:{})};
   const r=await fetcher(extra.target||service.baseUrl+route,{method,headers,...(body?{body:extra.form?body:JSON.stringify(body)}:{}),redirect:'error',signal});
   if(!r.ok){await r.body?.cancel();if(r.status===401)throw Error('API 密钥无效或与服务地址不匹配，请检查后重试。');if(r.status===429)throw Error('接口额度或请求频率已达上限，请查看服务商账户用量。');if(r.status===402)throw Error('接口额度不足，请到服务商账户查看余额。');if(r.status===403)throw Error('当前 API 账户无权限，或请求被服务商的内容规则拒绝。');if([400,404,405,422].includes(r.status))throw Error('AI 服务不支持当前接口、模型或参数（'+r.status+'）。请检查模型 ID、接口类型与输出格式。');throw Error('AI 服务返回错误（'+r.status+'），请稍后重试。')}
   if(extra.binary){if(r.headers.get('finish-reason')==='CONTENT_FILTERED'){await r.body?.cancel();throw Error('AI 服务未通过本次内容检查，请修改描述。')}return limitedBody(r,15*1024*1024)}
   const raw=await limitedBody(r,method==='GET'?1024*1024:24*1024*1024);return JSON.parse(raw.toString('utf-8'));
  }catch(e){if(e?.name==='TimeoutError'||e?.name==='AbortError')throw Error('AI 请求超时，请稍后重试。');if(e instanceof SyntaxError)throw Error('AI 返回了无法读取的数据。');if(e?.message?.includes('fetch failed'))throw Error('无法连接 AI 服务，请检查服务地址和网络。');throw e}finally{if(!extra.internal)busy=false}
 }
 async function imageBytes(url){
  // CDN URLs can contain signed query parameters. Never attach the API credential.
  let target=String(url||'');
  for(let hop=0;hop<4;hop++){
   let u;try{u=new URL(target)}catch{throw Error('AI 未返回可用的图片地址。')}
   if(u.protocol!=='https:'||u.username||u.password)throw Error('图片下载地址必须使用 HTTPS。');
   const r=await fetchImage(u.href,{redirect:'manual',signal:AbortSignal.timeout(45000),headers:{Accept:'image/png,image/jpeg,image/webp'}});
   if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw Error('图片下载重定向无效。');target=new URL(location,u).href;continue}
   if(!r.ok){await r.body?.cancel();throw Error('图片下载失败（'+r.status+'），请稍后重新生成。')}
   return limitedBody(r,15*1024*1024);
  }throw Error('图片下载重定向次数过多。');
 }
 return{
  status,configure,
  setKey(value){if(busy)return{ok:false,error:'另一个 AI 任务仍在进行，请稍后。'};if(!validKey(value)||!/^sk-/.test(value.trim()))return{ok:false,error:'请输入有效的 OpenAI API 密钥。'};keys.plan=keys.image=value.trim();return{ok:true}},
  clear(kind){if(busy)return{ok:false,error:'另一个 AI 任务仍在进行，请稍后。'};try{for(const k of kind==='plan'||kind==='image'?[kind]:['plan','image']){vault?.forget(k);keys[k]=''}return{ok:true,status:status()}}catch{return{ok:false,error:'配置清除失败，请重试。'}}},
  async models(kind){if(!['plan','image'].includes(kind))throw Error('配置无效。');if(['bfl-image','ideogram-image','stability-image'].includes(config[kind].protocol))throw Error('服务使用已内置的模型选项，无需读取列表。');const d=await request(kind,'models',null,20000,'GET');if(config[kind].protocol==='gemini-image'&&Array.isArray(d.models))d.data=d.models.map(m=>({id:m.name?.replace(/^models\//,'')}));if(!Array.isArray(d.data))throw Error('服务未提供兼容的模型列表，请手动填写模型 ID。');return [...new Set(d.data.map(m=>clipped(m?.id,160)).filter(m=>/^[-A-Za-z0-9_.:/@+]+$/.test(m)))].slice(0,500).sort()},
  async plan(input){
   const brief=clipped(input?.brief,2000);if(brief.length<8)throw Error('请先描述海报主题、用途或风格。');
   const assets=Array.isArray(input?.assets)?input.assets.slice(0,12).map(a=>({title:clipped(a.title,120),width:Number(a.width)||0,height:Number(a.height)||0,format:clipped(a.format,16),license:clipped(a.license,100),page:clipped(a.page,300)})):[];
   const service=config.plan,inputText=JSON.stringify({brief,existingAssets:assets});let d,output;
   if(service.protocol==='responses'){
    const format=service.jsonMode==='schema'?{type:'json_schema',name:'poster_plan',strict:true,schema}:service.jsonMode==='json'?{type:'json_object'}:undefined;
    d=await request('plan','responses',{model:service.model,store:false,max_output_tokens:3000,instructions,input:inputText,...(format?{text:{format}}:{})},120000);
    output=d.output_text||(d.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
   }else{
    const format=service.jsonMode==='schema'?{type:'json_schema',json_schema:{name:'poster_plan',strict:true,schema}}:service.jsonMode==='json'?{type:'json_object'}:undefined;
    d=await request('plan','chat/completions',{model:service.model,stream:false,max_tokens:4096,messages:[{role:'system',content:instructions},{role:'user',content:inputText}],...(format?{response_format:format}:{})},120000);
    if(d.choices?.[0]?.finish_reason==='length')throw Error('AI方案输出达到长度上限，请缩短需求或改用适合结构化输出的模型。');
    const content=d.choices?.[0]?.message?.content;output=typeof content==='string'?content:Array.isArray(content)?content.filter(p=>p.type==='text').map(p=>p.text).join(''):'';
   }return parsePlan(output);
  },
  async image(input){
   const prompt=clipped(input?.prompt,3000);if(prompt.length<8)throw Error('请描述需要生成的单张素材。');
   if(!keys.image)throw Error('请先配置生图服务并填写 API 密钥。');if(busy)throw Error('另一个 AI 任务仍在进行，请稍后。');busy=true;
   try{
    const size=['1024x1024','1024x1536','1536x1024'].includes(input?.size)?input.size:'1024x1024',service={...config.image};
    const ratio=size==='1024x1536'?'2:3':size==='1536x1024'?'3:2':'1:1';
    if(input?.transparent&&service.protocol!=='openai-image')throw Error('当前生图接口未启用透明背景能力，请取消透明背景，或选择支持此功能的 OpenAI 图像接口。');
    const call=(route,body,extra={})=>request('image',route,body,240000,'POST',{...extra,internal:true});
    let d,item,bytes;
    if(service.protocol==='gemini-image'){
     d=await call('interactions',{model:service.model,store:false,input:[{type:'text',text:prompt}],response_format:{type:'image',aspect_ratio:ratio}});
     const part=(d.steps||[]).filter(step=>step.type==='model_output').flatMap(step=>step.content||[]).find(block=>block.type==='image'&&typeof block.data==='string');
     if(part)item={b64_json:part.data};
     else if(d.output_image?.data)item={b64_json:d.output_image.data};
    }else if(service.protocol==='stability-image'){
     if(!['core','ultra'].includes(service.model))throw Error('模型选项不支持，请使用 Core 或 Ultra。');
     const form=new FormData();form.set('prompt',prompt);form.set('aspect_ratio',ratio);form.set('output_format','png');
     bytes=await call('stable-image/generate/'+service.model,form,{form:true,binary:true});
    }else if(service.protocol==='ideogram-image'){
     const form=new FormData();form.set('prompt',prompt);form.set('aspect_ratio',ratio.replace(':','x'));form.set('num_images','1');
     d=await call(encodeURIComponent(service.model),form,{form:true});item=d.data?.[0];
     if(item?.is_image_safe===false)throw Error('AI 服务未通过本次内容检查，请修改描述。');
    }else if(service.protocol==='bfl-image'){
     const [width,height]=size.split('x').map(Number);d=await call(encodeURIComponent(service.model),{prompt,width,height});
     if(typeof d.polling_url!=='string')throw Error('AI 服务没有返回可查询的任务。');
     const base=new URL(service.baseUrl),poll=new URL(d.polling_url);
     const validation=new URL(poll);validation.search='';validation.hash='';publicUrl(validation.href);
     const official=host=>host==='api.bfl.ai'||/^api\.[a-z0-9-]+\.bfl\.ai$/.test(host);
     if(poll.username||poll.password||poll.protocol!=='https:'||poll.port||(official(base.hostname)?!official(poll.hostname):poll.origin!==base.origin))throw Error('AI 服务返回的任务地址不可信，未向其发送密钥。');
     const deadline=Date.now()+240000;let ready=false;
     for(let attempt=0;attempt<80&&Date.now()<deadline;attempt++){
      await wait(3000);const result=await request('image','',null,Math.max(1000,Math.min(20000,deadline-Date.now())),'GET',{internal:true,target:poll.href});
      if(result.status==='Ready'){item={url:result.result?.sample};ready=true;break}
      if(['Error','Failed','Content Moderated','Request Moderated'].includes(result.status))throw Error('AI 服务未完成本次生成，请到服务商查看任务状态。');
     }
     if(!ready)throw Error('AI 任务仍未完成，可能仍在服务端运行。请先在平台查看，避免重复提交和扣费。');
    }else{
     const body={model:service.model,prompt};
     if(service.protocol==='openai-image')Object.assign(body,{n:1,size,quality:'medium',output_format:'png',background:input?.transparent?'transparent':'opaque'});
     else if(service.protocol==='siliconflow-image'){
      const kolors=/kolors/i.test(service.model);body.image_size=kolors?(ratio==='2:3'?'960x1280':ratio==='3:2'?'1280x960':'1024x1024'):ratio==='2:3'?'1056x1584':ratio==='3:2'?'1584x1056':'1328x1328';
     }else if(service.protocol==='seedream-image')Object.assign(body,{size:ratio==='2:3'?'1664x2496':ratio==='3:2'?'2496x1664':'2048x2048',response_format:'b64_json',stream:false,watermark:true});
     else if(service.protocol==='grok-image')Object.assign(body,{n:1,aspect_ratio:ratio,response_format:'b64_json'});
     else Object.assign(body,{n:1,size});
     d=await call('images/generations',body);item=d.data?.[0]||d.images?.[0];
    }
    if(!bytes){
     if(typeof item?.b64_json==='string'){
      const b64=item.b64_json;if(b64.length>21*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))throw Error('AI 未返回可用的图片。');bytes=Buffer.from(b64,'base64');
     }else if(typeof item?.url==='string')bytes=await imageBytes(item.url);
     else throw Error('AI 未返回可用的图片，可能被拦截或模型不支持生图。');
    }
    return{...checkedImage(bytes),prompt};
   }finally{busy=false}
  }

 };
}
module.exports={createAI,normalizePlan,publicError,serviceConfig};
