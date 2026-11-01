import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root:path.join(here,'renderer'),base:'/',publicDir:path.join(here,'../public'),plugins:[react()],worker:{format:'es'},build:{target:'chrome116',outDir:path.join(here,'app/ui'),emptyOutDir:true}});
