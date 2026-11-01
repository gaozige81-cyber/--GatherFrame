const assert=require('node:assert/strict');
const {createAI}=require('./app/ai.cjs');
const {createCredentialStore}=require('./app/ai-credentials.cjs');
const catalog=require('./app/ai-catalog.json');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/8t8AAAAASUVORK5CYII=','base64'),b64=png.toString('base64');
const fakeKey='fake-catalog-key-not-for-real-use';
(async()=>{
 const results=[];
 for(const provider of catalog.providers.filter(p=>p.image&&p.id!=='custom')){
  const sent=[],download=[];let polls=0;
  const ai=createAI(async(url,init)=>{
   sent.push({url,...init});const protocol=provider.image.protocol;
   if(protocol==='gemini-image')return Response.json({steps:[{type:'model_output',content:[{type:'image',data:b64,mime_type:'image/png'}]}]});
   if(protocol==='stability-image')return new Response(png,{headers:{'content-type':'image/png'}});
   if(protocol==='bfl-image'){
    if(init.method==='POST')return Response.json({id:'task-one',polling_url:'https://api.eu1.bfl.ai/v1/get_result?id=task-one'});
    return Response.json(++polls===1?{status:'Pending'}:{status:'Ready',result:{sample:'https://cdn.shicai-app.com/flux.png'}});
   }
   if(protocol==='ideogram-image')return Response.json({data:[{is_image_safe:true,url:'https://cdn.shicai-app.com/ideogram.png'}]});
   return Response.json({data:[{b64_json:b64}]});
  },{wait:async()=>{},fetchImage:async(url,init)=>{download.push({url,...init});return new Response(png)}});
  assert.equal(ai.configure('image',provider.image,fakeKey).ok,true,provider.id);
  const image=await ai.image({prompt:'Create one green plant collage element',size:'1024x1536'});assert.deepEqual(Buffer.from(image.data),png,provider.id);
  assert.equal(sent.filter(r=>r.method==='POST').length,1,'exactly one paid submission per click');
  assert.ok(sent.every(r=>r.redirect==='error'));assert.ok(download.every(r=>!Object.keys(r.headers).some(k=>/authorization|api-key|x-key/i.test(k))));
  const request=sent[0];
  if(provider.id==='gemini'){assert.equal(request.headers['x-goog-api-key'],fakeKey);assert.equal(request.headers.Authorization,undefined);const body=JSON.parse(request.body);assert.equal(body.store,false);assert.equal(body.response_format.aspect_ratio,'2:3');assert.ok(request.url.endsWith('/interactions'))}
  else if(provider.id==='stability'){assert.equal(request.headers['Content-Type'],undefined);assert.equal(request.body.get('aspect_ratio'),'2:3');assert.equal(request.body.get('output_format'),'png');assert.ok(request.url.endsWith('/stable-image/generate/core'))}
  else if(provider.id==='ideogram'){assert.equal(request.headers['Api-Key'],fakeKey);assert.equal(request.body.get('aspect_ratio'),'2x3');assert.equal(request.headers['Content-Type'],undefined);assert.ok(request.url.endsWith('/v2/image/generate/ideogram-3'))}
  else if(provider.id==='bfl'){assert.equal(sent.length,3);assert.ok(sent.every(r=>r.headers['x-key']===fakeKey));assert.equal(JSON.parse(request.body).height,1536)}
  else{assert.equal(request.headers.Authorization,'Bearer '+fakeKey);const body=JSON.parse(request.body);if(provider.id==='seedream'){assert.equal(body.size,'1664x2496');assert.equal(body.watermark,true);assert.equal(body.response_format,'b64_json')}if(provider.id==='grok'){assert.equal(body.aspect_ratio,'2:3');assert.equal(body.size,undefined)}if(provider.id==='siliconflow')assert.equal(body.image_size,'960x1280')}
  assert.equal(ai.status().busy,false);results.push(provider.id);
 }
 const bfl=catalog.providers.find(p=>p.id==='bfl').image;
 let count=0;const hostile=createAI(async()=>{count++;return Response.json({polling_url:'https://other-company.shicai-app.com/steal-key'})},{wait:async()=>{}});hostile.configure('image',bfl,fakeKey);await assert.rejects(hostile.image({prompt:'Create one green plant collage element'}),/不可信/);assert.equal(count,1,'key not sent to untrusted task URL');
 count=0;const pending=createAI(async(url,init)=>{if(init.method==='POST'){count++;return Response.json({polling_url:'https://api.bfl.ai/v1/get_result?id=slow'})}return Response.json({status:'Pending'})},{wait:async()=>{}});pending.configure('image',bfl,fakeKey);await assert.rejects(pending.image({prompt:'Create one green plant collage element'}),/避免重复提交/);assert.equal(count,1);
 let config,encrypted={};
 const system={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from('cipher:'+value.split('').reverse().join('')),decryptString:value=>value.toString().slice(7).split('').reverse().join('')};
 const store=()=>createCredentialStore({safeStorage:system,read:()=>encrypted,write:value=>{encrypted=structuredClone(value)}});
 let ai=createAI(async()=>{throw Error('no automatic request expected')},{credentialStore:store(),readConfig:()=>config,writeConfig:value=>{config=structuredClone(value)}});
 const service=catalog.providers.find(p=>p.id==='gemini').image;
 assert.equal(ai.configure('image',service,fakeKey,true).ok,true);assert.equal(ai.status().services.image.remembered,true);assert.ok(!JSON.stringify(encrypted).includes(fakeKey));assert.ok(!JSON.stringify(config).includes(fakeKey));
 ai=createAI(async()=>{throw Error('no automatic request expected')},{credentialStore:store(),readConfig:()=>config,writeConfig:value=>{config=structuredClone(value)}});assert.equal(ai.status().services.image.connected,true,'restored after restart without network request');
 ai.configure('image',{...service,baseUrl:'https://other.shicai-app.com/v1/'});assert.equal(ai.status().services.image.connected,false);assert.equal(encrypted.image,undefined);
 ai.configure('image',service,fakeKey,true);assert.equal(ai.clear('image').ok,true);assert.equal(encrypted.image,undefined);
 const unavailable=createCredentialStore({safeStorage:{...system,isEncryptionAvailable:()=>false},write:()=>{throw Error('must not write')}});ai=createAI(async()=>{}, {credentialStore:unavailable});assert.equal(ai.configure('image',service,fakeKey,true).ok,false);assert.equal(ai.status().services.image.connected,false);
 const plaintext=createCredentialStore({platform:'linux',safeStorage:{...system,getSelectedStorageBackend:()=>'basic_text'}});assert.equal(plaintext.available(),false);
 const migrated=createAI(async()=>{}, {readConfig:()=>({image:{...catalog.providers[0].image,model:'gpt-image-1'}})});assert.equal(migrated.status().services.image.model,'gpt-image-2.5-flare');
 const custom=createAI(async()=>{}, {readConfig:()=>({image:{...catalog.providers[0].image,baseUrl:'https://custom.shicai-app.com/v1/',model:'gpt-image-1'}})});assert.equal(custom.status().services.image.model,'gpt-image-1');
 assert.equal(catalog.web.length,10);assert.equal(new Set(catalog.web.map(p=>p.url)).size,10);assert.ok(catalog.web.every(p=>new URL(p.url).protocol==='https:'));
 console.log(JSON.stringify({passed:true,imageProviders:results,checks:['one paid POST per generation','native JSON and multipart formats','provider-specific authentication','Gemini image parts','Seedream and Grok sizes','FLUX trusted polling without credential leak or resubmission','CDN isolation','optional system-encrypted credential restore','endpoint-bound credentials and disconnect removal','no plaintext fallback','retired official model migration','10 official no-API web entries']}));
})().catch(e=>{console.error(e);process.exitCode=1});
