import argparse,hashlib,json,pathlib,re,shutil,zipfile

root=pathlib.Path(__file__).resolve().parent
source=root/'extension'
parser=argparse.ArgumentParser(description='从清译源码生成安装目录与ZIP；不会覆盖已有未知内容。')
parser.add_argument('name',nargs='?',default='清译_V1')
parser.add_argument('--output-dir',type=pathlib.Path,default=root.parent.parent/'outputs')
parser.add_argument('--recover',action='store_true',help='仅当现有目录与当前源码逐字节一致时恢复打包')
args=parser.parse_args()
output=args.output_dir.resolve()
name=args.name
if not re.fullmatch(r'清译_V[1-9]\d*',name): raise SystemExit('交付名称格式不符。')
target=output/name
archive=output/(name+'.zip')
recover=args.recover
if (target.exists() or archive.exists()) and not recover:
    raise SystemExit('交付目标已存在，须核对归属后再更新。')
output.mkdir(parents=True,exist_ok=True)
if recover:
    expected={f.relative_to(source).as_posix():f.read_bytes() for f in source.rglob('*') if f.is_file()}
    expected['安装与使用.txt']=(root/'安装与使用.txt').read_bytes()
    actual={f.relative_to(target).as_posix():f.read_bytes() for f in target.rglob('*') if f.is_file()}
    if actual!=expected: raise SystemExit('已有目录与当前任务候选不一致，拒绝覆盖。')
else:
    shutil.copytree(source,target)
    shutil.copyfile(root/'安装与使用.txt',target/'安装与使用.txt')
manifest=json.loads((target/'manifest.json').read_text(encoding='utf-8'))
assert manifest['manifest_version']==3
required=[manifest['background']['service_worker'],manifest['action']['default_popup'],*manifest['icons'].values()]
required += [name for item in manifest['content_scripts'] for name in item['js']]
assert all((target/name).is_file() for name in required)
hashes={}
for f in source.rglob('*'):
    if f.is_file():
        relative_name=f.relative_to(source).as_posix()
        digest=hashlib.sha256(f.read_bytes()).hexdigest()
        assert hashlib.sha256((target/relative_name).read_bytes()).hexdigest()==digest
        hashes[relative_name]=digest
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for f in target.rglob('*'):
        if f.is_file(): z.write(f,f.relative_to(output))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert json.loads(z.read(name+'/manifest.json'))==manifest
(root/'package-evidence.json').write_text(json.dumps({'files':hashes,'archive_bytes':archive.stat().st_size,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2),encoding='utf-8')
print(json.dumps({'file_count':len(hashes)+1,'archive':str(archive),'bytes':archive.stat().st_size},ensure_ascii=True))
