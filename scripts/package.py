"""Build a deterministic, Folia-installable unsigned zip with Python 3 stdlib."""
from pathlib import Path
import hashlib,json,zipfile

root=Path(__file__).resolve().parent.parent
mod=root/'bpm-style-director'
manifest=json.loads((mod/'mod.json').read_text(encoding='utf-8'))
assert manifest['id']==mod.name
assert manifest['version']=='1.0.0'
assert (mod/manifest['preview']).is_file()
assert not (mod/'folium.sig.json').exists()
dist=root/'dist';dist.mkdir(exist_ok=True)
target=dist/f"{manifest['id']}-{manifest['version']}.zip"
files=sorted(p for p in mod.rglob('*') if p.is_file())
assert not any(p.is_symlink() for p in mod.rglob('*'))
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in files:
        info=zipfile.ZipInfo(file.relative_to(root).as_posix(),date_time=(2026,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.create_system=3
        info.external_attr=0o100644<<16
        archive.writestr(info,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert json.loads(archive.read('bpm-style-director/mod.json'))['version']=='1.0.0'
digest=hashlib.sha256(target.read_bytes()).hexdigest()
(dist/'SHA256SUMS.txt').write_text(f'{digest}  {target.name}\n',encoding='utf-8')
print(json.dumps({'filename':target.name,'bytes':target.stat().st_size,'files':len(files),'sha256':digest}))
