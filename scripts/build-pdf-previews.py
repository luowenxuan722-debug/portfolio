"""Generate independent WebP pages for the portfolio's online preview."""
from pathlib import Path
import hashlib,json,subprocess,tempfile
from PIL import Image
root=Path(__file__).resolve().parents[1]
out=root/'dist/assets/pdf-pages';out.mkdir(parents=True,exist_ok=True)
index={}
for pdf in sorted((root/'dist/assets/pdfs').glob('*.pdf')):
 with tempfile.TemporaryDirectory(prefix='portfolio-pdf-pages-') as tmp:
  subprocess.run(['pdftoppm','-scale-to-x','1600','-scale-to-y','-1','-png',str(pdf),str(Path(tmp)/'page')],check=True,stdout=subprocess.DEVNULL)
  pages=[]
  for png in sorted(Path(tmp).glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1])):
   image=Image.open(png).convert('RGB')
   webp=Path(tmp)/'page.webp';image.save(webp,'WEBP',quality=85,method=6)
   data=webp.read_bytes();name=hashlib.sha256(data).hexdigest()[:20]+'.webp'
   target=out/name
   if not target.exists():target.write_bytes(data)
   pages.append({'src':'./assets/pdf-pages/'+name,'width':image.width,'height':image.height})
  index['./assets/pdfs/'+pdf.name]=pages
  print(f'{pdf.name}: {len(pages)} pages',flush=True)
(root/'src/pdf-preview-pages.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
print(f'{len(list(out.glob("*.webp")))} unique images; {sum(p.stat().st_size for p in out.glob("*.webp"))/1e6:.2f} MB')
