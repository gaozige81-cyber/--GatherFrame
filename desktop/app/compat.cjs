// Feature detection keeps JSON responses available across legacy runtime builds.
if(typeof Response!=='undefined' && typeof Response.json!=='function'){
 Object.defineProperty(Response,'json',{configurable:true,writable:true,value(data,init={}){
  const body=JSON.stringify(data);if(body===undefined)throw new TypeError('Value is not JSON serializable');
  const headers=new Headers(init.headers);if(!headers.has('content-type'))headers.set('content-type','application/json');
  return new Response(body,{...init,headers});
 }});
}
