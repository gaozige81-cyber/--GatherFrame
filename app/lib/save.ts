import type {SaveResult} from './preferences';
export async function saveBlob(data:Blob,name:string):Promise<SaveResult>{if(window.shicaiDesktop)return window.shicaiDesktop.saveDownload({name,data:new Uint8Array(await data.arrayBuffer())});const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return{status:'browser'}}
export function saveMessage(r:SaveResult){return r.status==='saved'?'已保存到：'+r.path:r.status==='canceled'?'已取消保存':r.status==='error'?(r.error||'保存失败，请更换目录'):'文件已交给浏览器，请确认下载是否完成。'}
