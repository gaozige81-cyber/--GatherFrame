import {sha256} from '@noble/hashes/sha2.js';
// IDs identify local rows only. They are never credentials or access tokens.
export function localId(){if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();const b=new Uint8Array(16);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(b);else for(let i=0;i<b.length;i++)b[i]=Math.floor(Math.random()*256);return Array.from(b,v=>v.toString(16).padStart(2,'0')).join('')}
export async function digestHex(bytes:Uint8Array){const hash=globalThis.crypto?.subtle?new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)):sha256(bytes);return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')}
