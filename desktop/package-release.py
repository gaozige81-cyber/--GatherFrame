"""Prepare official runtime payloads; never copy userData or any local settings."""
from pathlib import Path
import shutil,plistlib,os,json
root=Path(__file__).resolve().parents[1]
runtime=Path(os.environ['SHICAI_RUNTIME'])
app=root/'desktop/app'
# Explicit runtime allowlist: generated renderer + server/API + narrow native bridge.
files=['main.cjs','preload.cjs','server.mjs','file-utils.cjs','safe-network.cjs','ai.cjs','ai-catalog.json','ai-credentials.cjs','updater.cjs','update-channel.json','compat.cjs','distribution.json','icon.png','icon.ico','package.json']
serverlibs=['assets.mjs','image-bytes.mjs','public-fetch.mjs','extract.mjs','network-error.mjs']
def payload(dest):
 if dest.exists():shutil.rmtree(dest)
 dest.mkdir(parents=True)
 for name in files:shutil.copy2(app/name,dest/name)
 for folder in ['api','ui']:shutil.copytree(app/folder,dest/folder)
 (dest/'lib').mkdir()
 for name in serverlibs:shutil.copy2(app/'lib'/name,dest/'lib'/name)
 shutil.copy2(root/'THIRD_PARTY_NOTICES.txt',dest/'THIRD_PARTY_NOTICES.txt')
for arch in os.environ.get('SHICAI_ARCHES','win32-x64').split(','):
 platform=runtime/arch
 if arch=='win32-x64':
  if (platform/'electron.exe').exists():(platform/'electron.exe').rename(platform/'拾材.exe')
  (platform/'resources/default_app.asar').unlink(missing_ok=True)
  payload(platform/'resources/app')
  # Exact file inventory makes uninstall preserve unrelated files.
  paths=[p for p in platform.rglob('*') if p.is_file()]
  dirs=sorted([p for p in platform.rglob('*') if p.is_dir()],key=lambda p:len(p.parts),reverse=True)
  escape=lambda s:str(s).replace('/', '\\').replace('$','$$').replace('"','$\\"')
  lines=['; Generated from the payload. Do not recursively delete the installation directory.']
  for p in sorted(paths):lines.append('Delete "$INSTDIR\\'+escape(p.relative_to(platform))+'"')
  for p in dirs:lines.append('RMDir "$INSTDIR\\'+escape(p.relative_to(platform))+'"')
  (root/'desktop/uninstall-files.nsh').write_text('\n'.join(lines)+'\n')
 else:
  raise ValueError('Mac packages must use make-mac-installers.py to preserve profile-specific runtime requirements')

 print(arch,'payload prepared',flush=True)
