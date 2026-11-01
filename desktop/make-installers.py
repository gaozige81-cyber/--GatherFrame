"""Assemble distributable Windows and macOS installers from verified Electron zips.

Run after `node desktop/build.mjs` and the desktop Vite build. Supply the
official Electron v44.9.1 Windows zip plus the Mac profile zips and checksums
listed in make-mac-installers.py in SHICAI_RUNTIME.
"""
from __future__ import annotations

import hashlib
import os
import pathlib
import shutil
import stat
import subprocess
import sys
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNTIME = pathlib.Path(os.environ['SHICAI_RUNTIME']).resolve()
OUTPUT = pathlib.Path(os.environ.get('SHICAI_OUTPUT', ROOT / 'release')).resolve()
VERSION = '2.3.0'
ARCHES = ('win32-x64',)


def verify_downloads():
    checksums = {}
    for line in (RUNTIME / 'SHASUMS256.txt').read_text().splitlines():
        if ' *' in line:
            digest, name = line.split(' *', 1)
            checksums[name] = digest
    for arch in ARCHES:
        name = f'electron-v44.9.1-{arch}.zip'
        archive = RUNTIME / name
        if name not in checksums or not archive.is_file():
            raise ValueError(f'Missing official runtime or digest: {name}')
        hash_ = hashlib.sha256()
        with archive.open('rb') as file:
            for chunk in iter(lambda: file.read(2**20), b''):
                hash_.update(chunk)
        if hash_.hexdigest() != checksums[name]:
            raise ValueError(f'Official checksum mismatch: {name}')
        print(name, 'SHA-256 verified', flush=True)


def verify_windows_installer(archive):
    """Reject an installer whose trailing NSIS CRC is missing or corrupt."""
    size = archive.stat().st_size
    if size < 516:
        raise ValueError('Windows installer is incomplete')
    checksum = 0
    with archive.open('rb') as file:
        file.seek(512)  # NSIS omits the first 512 bytes of the PE stub.
        remaining = size - 516
        while remaining:
            block = file.read(min(2**20, remaining))
            if not block:
                raise ValueError('Windows installer ended before the CRC')
            checksum = zlib.crc32(block, checksum)
            remaining -= len(block)
        expected = int.from_bytes(file.read(4), 'little')
    if checksum != expected:
        raise ValueError('Windows installer failed NSIS CRC verification; do not distribute it')
    print(archive, 'NSIS CRC verified', flush=True)


def extract(arch):
    target = RUNTIME / arch
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
    with zipfile.ZipFile(RUNTIME / f'electron-v44.9.1-{arch}.zip') as archive:
        for item in archive.infolist():
            name = pathlib.PurePosixPath(item.filename)
            if name.is_absolute() or '..' in name.parts:
                raise ValueError('Unexpected runtime archive path')
            dest = target.joinpath(*name.parts)
            mode = item.external_attr >> 16
            if item.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            if stat.S_ISLNK(mode):
                link = archive.read(item).decode()
                if pathlib.PurePosixPath(link).is_absolute() or '..' in pathlib.PurePosixPath(link).parts:
                    raise ValueError('Unexpected runtime symlink')
                dest.symlink_to(link)
            else:
                with archive.open(item) as source, dest.open('wb') as output:
                    shutil.copyfileobj(source, output)
                if mode:
                    dest.chmod(stat.S_IMODE(mode))
    print(arch, 'runtime extracted', flush=True)


def main():
    verify_downloads()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for arch in ARCHES:
        extract(arch)
    env = dict(os.environ, SHICAI_RUNTIME=str(RUNTIME), SHICAI_ARCHES="win32-x64")
    subprocess.run([sys.executable, str(ROOT / 'desktop/package-release.py')], cwd=ROOT, env=env, check=True)
    makensis = os.environ.get('SHICAI_MAKENSIS') or shutil.which('makensis')
    if not makensis:
        raise ValueError('makensis required for Windows installer; set SHICAI_MAKENSIS')
    win = OUTPUT / f'ShiCai-{VERSION}-Windows-x64-Setup.exe'
    nsis_env = dict(env)
    nsis_env['NSISDIR'] = os.environ.get('SHICAI_NSISDIR', '/usr/share/nsis')
    subprocess.run([makensis, '-V2', f'-DPAYLOAD={RUNTIME / "win32-x64"}', f'-DOUTPUT={win}', str(ROOT / 'desktop/installer.nsi')], cwd=ROOT / 'desktop', env=nsis_env, check=True)
    verify_windows_installer(win)
    print(win, 'ready', flush=True)
    subprocess.run([sys.executable, str(ROOT / 'desktop/make-mac-installers.py'), '--runtime', str(RUNTIME), '--output', str(OUTPUT)], check=True)


if __name__ == '__main__':
    main()
