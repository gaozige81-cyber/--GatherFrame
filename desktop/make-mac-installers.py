"""Assemble Mac ZIPs on any host, preserving Unix modes and symlinks.

Run desktop/build.mjs and the desktop Vite build first. This does not sign or
notarize the application. The included Mac installer performs local ad-hoc
signing on the destination computer.
"""
from pathlib import Path, PurePosixPath
import argparse, copy, hashlib, json, plistlib, posixpath, shutil, stat, struct, zipfile

ROOT=Path(__file__).resolve().parents[1]
VERSION='2.3.0'
PROFILES=[
 {'arch':'arm64','electron':'43.8.3','minimum':'12.0','channel':'standard','suffix':''},
 {'arch':'x64','electron':'43.8.3','minimum':'12.0','channel':'standard','suffix':''},
 {'arch':'x64','electron':'26.6.10','minimum':'10.14','channel':'legacy','suffix':'-Legacy'},
 {'arch':'arm64','electron':'37.10.3','minimum':'11.0','channel':'bigsur','suffix':'-BigSur'},
]

def version_tuple(value):return tuple((list(map(int,value.split('.')))+[0,0,0])[:3])

def binary_minimum(file):
    header=file.read(32)
    if len(header)<32 or struct.unpack('<I',header[:4])[0]!=0xfeedfacf:return None
    count,size=struct.unpack_from('<II',header,16)
    assert size<16*1024*1024
    commands=file.read(size);offset=0;minimum=None
    for _ in range(count):
        kind,length=struct.unpack_from('<II',commands,offset);assert length>=8 and offset+length<=len(commands)
        if kind in (0x32,0x24):
            value=struct.unpack_from('<I',commands,offset+(12 if kind==0x32 else 8))[0]
            minimum=(value>>16,(value>>8)&255,value&255)
        offset+=length
    return minimum


def rename(name):
    name=name.replace('Electron.app/', '拾材.app/',1)
    name=name.replace('Electron Helper', '拾材 Helper')
    if name=='拾材.app/Contents/MacOS/Electron':name='拾材.app/Contents/MacOS/拾材'
    return name

def new_entry(name, mode=0o644):
    info=zipfile.ZipInfo(name)
    info.create_system=3
    info.external_attr=(stat.S_IFREG|mode)<<16
    info.compress_type=zipfile.ZIP_DEFLATED
    return info

def manifest():
    app=ROOT/'desktop/app'
    names=['main.cjs','preload.cjs','server.mjs','file-utils.cjs','safe-network.cjs','ai.cjs','ai-catalog.json','ai-credentials.cjs','updater.cjs','update-channel.json','compat.cjs','distribution.json','icon.png','icon.ico','package.json']
    files={name:app/name for name in names}
    for folder in ['api','lib','ui']:
        for path in (app/folder).rglob('*'):
            if path.is_file():files[path.relative_to(app).as_posix()]=path
    files['THIRD_PARTY_NOTICES.txt']=ROOT/'THIRD_PARTY_NOTICES.txt'
    assert 'ui/index.html' in files, 'Build the renderer before packaging'
    assert json.loads((app/'package.json').read_text(encoding='utf-8'))['version']==VERSION
    return files

def validate(path, profile, files, source_links):
    arch=profile['arch']
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None, 'ZIP integrity failure'
        names=z.namelist();assert len(names)==len(set(names)), 'Duplicate archive entry'
        assert all(not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts for n in names)
        plist=plistlib.loads(z.read('拾材.app/Contents/Info.plist'))
        assert plist['CFBundleExecutable']=='拾材' and plist['CFBundleShortVersionString']==VERSION
        assert plist['LSMinimumSystemVersion']==profile['minimum']
        main='拾材.app/Contents/MacOS/拾材'
        assert z.getinfo(main).external_attr>>16 & 0o111
        with z.open(main) as f:magic,cpu=struct.unpack('<II',f.read(8))
        assert magic==0xfeedfacf and cpu=={'arm64':0x100000c,'x64':0x1000007}[arch]
        assert z.getinfo('安装拾材.command').external_attr>>16 & 0o111
        command=z.read('安装拾材.command').decode('utf-8')
        assert '__SHICAI_ARCH__' not in command and '\r' not in command
        for relative,source in files.items():
            if relative=='distribution.json':
                assert json.loads(z.read('拾材.app/Contents/Resources/app/'+relative))['channel']==profile['channel'];continue
            with z.open('拾材.app/Contents/Resources/app/'+relative) as file:
                assert hashlib.file_digest(file,'sha256').digest()==hashlib.sha256(source.read_bytes()).digest(),relative
        links={i.filename:z.read(i).decode('utf-8') for i in z.infolist() if stat.S_ISLNK(i.external_attr>>16)}
        assert links==source_links, 'Unexpected runtime symlink inventory'
        for name,target in links.items():
            assert not target.startswith('/')
            pending=posixpath.join(posixpath.dirname(name),target).split('/');resolved=[];hops=0
            while pending:
                part=pending.pop(0)
                if part in ('','.'):continue
                if part=='..':
                    assert resolved;resolved.pop();continue
                candidate='/'.join(resolved+[part])
                if candidate in links:
                    hops+=1;assert hops<32
                    pending=links[candidate].split('/')+pending
                else:resolved.append(part)
            final='/'.join(resolved)
            assert final.startswith('拾材.app/') and (final in names or final+'/' in names or any(n.startswith(final+'/') for n in names)),(name,final)
        for name in names:
            if name.endswith('.app/Contents/Info.plist') and '/拾材 Helper' in name:
                helper=plistlib.loads(z.read(name));binary=posixpath.dirname(name)+'/MacOS/'+helper['CFBundleExecutable']
                assert binary in names and z.getinfo(binary).external_attr>>16 & 0o111
        binaries={}
        for entry in z.infolist():
            if entry.is_dir() or stat.S_ISLNK(entry.external_attr>>16):continue
            with z.open(entry) as f:minimum=binary_minimum(f)
            if minimum:
                assert minimum<=version_tuple(profile['minimum']),(entry.filename,minimum,profile['minimum'])
                binaries[entry.filename]='.'.join(map(str,minimum))
        assert len(binaries)>=8, 'Missing Mach-O runtime binaries'
        return {'electron':profile['electron'],'minimum_macos':profile['minimum'],'channel':profile['channel'],'native_binary_minimums':binaries,'architecture':arch,'files':len(names),'symlinks':len(links),'app_files':len(files),'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest()}

def build(runtime, output, profile, sums, files):
    arch=profile['arch'];electron=profile['electron']
    filename=f'electron-v{electron}-darwin-{arch}.zip';archive=runtime/filename
    with archive.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==sums[filename], 'Official runtime checksum mismatch'
    target=output/f'ShiCai-{VERSION}-macOS-{arch}{profile['suffix']}-Installer.zip'
    with zipfile.ZipFile(archive) as source,zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as dest:
        source_links={rename(i.filename):source.read(i).decode('utf-8').replace('Electron Helper','拾材 Helper') for i in source.infolist() if i.filename.startswith('Electron.app/') and stat.S_ISLNK(i.external_attr>>16)}
        for old in source.infolist():
            if not old.filename.startswith('Electron.app/') or old.filename=='Electron.app/Contents/Resources/default_app.asar':continue
            info=copy.copy(old);info.filename=rename(old.filename);info.create_system=3
            if old.filename.endswith('/Info.plist'):
                data=plistlib.loads(source.read(old))
                if old.filename=='Electron.app/Contents/Info.plist':
                    data.update(CFBundleName='拾材',CFBundleDisplayName='拾材',CFBundleIdentifier='app.shicai.desktop',CFBundleExecutable='拾材',CFBundleIconFile='shicai.icns',CFBundleShortVersionString=VERSION,CFBundleVersion=VERSION,LSMinimumSystemVersion=profile['minimum'],NSHumanReadableCopyright='ShiCai Desktop 2026')
                    for key in ['CFBundleDocumentTypes','CFBundleURLTypes']:data.pop(key,None)
                elif old.filename.endswith('.app/Contents/Info.plist') and '/Electron Helper' in old.filename:
                    old_name=data.get('CFBundleExecutable') or PurePosixPath(old.filename).parents[1].name.removesuffix('.app')
                    assert posixpath.dirname(old.filename)+'/MacOS/'+old_name in source.namelist()
                    new_name=old_name.replace('Electron','拾材',1)
                    role=old_name.replace('Electron Helper','').strip(' ()').lower()
                    data.update(CFBundleExecutable=new_name,CFBundleName=new_name,CFBundleDisplayName=new_name,CFBundleIdentifier='app.shicai.desktop.helper'+('.'+role if role else ''))
                dest.writestr(info,plistlib.dumps(data))
            elif stat.S_ISLNK(old.external_attr>>16):dest.writestr(info,source.read(old).replace(b'Electron Helper','拾材 Helper'.encode()))
            else:
                with source.open(old) as inp,dest.open(info,'w') as out:shutil.copyfileobj(inp,out,1024*1024)
        dest.writestr(new_entry('拾材.app/Contents/Resources/shicai.icns'),(ROOT/'desktop/icon.icns').read_bytes())
        for relative,path in files.items():dest.writestr(new_entry('拾材.app/Contents/Resources/app/'+relative),(json.dumps({'channel':profile['channel']}).encode() if relative=='distribution.json' else path.read_bytes()))
        command=(ROOT/'desktop/install-mac.command').read_text(encoding='utf-8').replace('__SHICAI_ARCH__','arm64' if arch=='arm64' else 'x86_64').replace('__SHICAI_MIN_OS__',profile['minimum'])
        dest.writestr(new_entry('安装拾材.command',0o755),command.encode())
        dest.writestr(new_entry('entitlements.plist'),(ROOT/'desktop/entitlements.plist').read_bytes())
        dest.writestr(new_entry('请先阅读.txt'),('本安装包：'+arch+'；最低系统：macOS '+profile['minimum']+'；运行环境：Electron '+electron+'。\n'+('旧系统兼容版：运行环境已停止安全更新，仅供无法升级系统的 Mac 选用。\n' if profile['channel']!='standard' else '')+'\n'+(ROOT/'desktop/mac-readme.txt').read_text(encoding='utf-8')).encode())
        dest.writestr(new_entry('检查我的Mac.command',0o755),(ROOT/'desktop/check-mac.command').read_bytes())
    report=validate(target,profile,files,source_links);print(target.name,json.dumps(report),flush=True)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--runtime',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    sums={}
    for profile in PROFILES:
        for line in (args.runtime/('SHASUMS256-'+profile['electron']+'.txt')).read_text().splitlines():
            parts=line.split();
            if len(parts)==2:sums[parts[1].lstrip('*')]=parts[0]
    files=manifest();reports=[build(args.runtime,args.output,profile,sums,files) for profile in PROFILES]
    (args.output/f'ShiCai-{VERSION}-Mac-Validation.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
