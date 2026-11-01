"""Export a clean, reviewable GitHub source archive, without Site identity."""
from __future__ import annotations

import pathlib
import subprocess
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
destination = pathlib.Path(sys.argv[1]).resolve()
paths = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
skipped = {'.openai/hosting.json', 'tsconfig.tsbuildinfo', 'desktop/uninstall-files.nsh'}
directories = ('desktop/app/ui/', 'desktop/app/api/', 'desktop/app/lib/', 'desktop/__pycache__/')
files = []
for name in sorted(set(paths)):
    if not name or name in skipped or name.startswith(directories):
        continue
    path = root / name
    if not path.is_file() or path.is_symlink():
        continue
    files.append(name)
destination.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for name in files:
        archive.write(root / name, 'ShiCai-2.2.0-source/' + name)
with zipfile.ZipFile(destination) as archive:
    if archive.testzip():
        raise ValueError('Source ZIP did not pass CRC verification')
print(f'{destination.name}: {len(files)} audited source files')
