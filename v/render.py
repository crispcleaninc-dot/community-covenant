import json, os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920; G='/home/claude/mih/gen/'; O=sys.argv[1]  # outputs dir (images+wavs)
D=json.load(open(G+'lines.json'))
LAT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT={'ar':'/home/claude/fonts/NotoSansArabic-Bold.ttf','hi':'/home/claude/fonts/NotoSansDevanagari-Bold.ttf','zh':'/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'}
HEAD={'a':{'en':"Mommy isn't a superhero.",'es':'Mamá no es una superheroína.','fr':"Maman n'est pas une super-héroïne.",'hi':'माँ सुपरहीरो नहीं है।','ar':'ماما ليست بطلة خارقة.','zh':'妈妈不是超级英雄。'},
 'b':{'en':'Is it my fault, Mommy?','es':'¿Es mi culpa, mamá?','fr':'C’est de ma faute, maman ?','hi':'क्या यह मेरी गलती है, माँ?','ar':'هل هذا ذنبي يا ماما؟','zh':'妈妈，是我的错吗？'},
 'c':{'en':'What are YOU getting, Mom?','es':'¿Y tú qué te compras, mamá?','fr':'Et toi, maman, tu prends quoi ?','hi':'माँ, आप अपने लिए क्या लेंगी?','ar':'وأنتِ يا ماما، ماذا ستشترين لنفسك؟','zh':'妈妈，你给自己买什么？'}}
TAG={'en':{'mom':'MOMMY','jojo':'JOJO','pip':'PIP'},'es':{'mom':'MAMÁ','jojo':'JOJO','pip':'PIP'},'fr':{'mom':'MAMAN','jojo':'JOJO','pip':'PIP'},
 'hi':{'mom':'माँ','jojo':'जोजो','pip':'पिप'},'ar':{'mom':'ماما','jojo':'جوجو','pip':'بيب'},'zh':{'mom':'妈妈','jojo':'乔乔','pip':'皮普'}}
CTA={'en':'Books & app · Subscribe','es':'Libros y app · Suscríbete','fr':'Livres et appli · Abonnez-vous','hi':'किताबें और ऐप | सब्सक्राइब','ar':'الكتب والتطبيق، اشترك','zh':'书和应用 · 订阅'}
def F(lang,s): return ImageFont.truetype(FONT.get(lang,LAT),s)
def wrap(d,t,f,mw,lang):
    if lang=='zh':
        out=[];line=''
        for ch in t:
            if d.textlength(line+ch,font=f)<=mw: line+=ch
            else: out.append(line); line=ch
        return out+[line] if line else out
    out=[];line=''
    for w in t.split():
        tt=(line+' '+w).strip()
        if d.textlength(tt,font=f)<=mw: line=tt
        else: out.append(line); line=w
    return out+[line] if line else out
def pick(shot):
    for sd in (7301,7302):
        p=f'{O}/{shot}_{sd}.webp'
        if os.path.exists(p): return p
def overlay(lang,s,role,text,cta):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,230),fill=(30,20,30,150))
    fb=ImageFont.truetype(LAT,30); t='MOMMY IS HUMAN TOO'; d.text(((W-d.textlength(t,font=fb))/2,52),t,font=fb,fill=(240,190,80))
    fh=F(lang,58); h=HEAD[s][lang]
    while d.textlength(h,font=fh)>W-80: fh=F(lang,fh.size-4)
    d.text(((W-d.textlength(h,font=fh))/2,108),h,font=fh,fill='white')
    sz=50 if lang!='zh' else 52; fc=F(lang,sz); lines=wrap(d,text,fc,W-160,lang)
    while len(lines)>6 and sz>36: sz-=4; fc=F(lang,sz); lines=wrap(d,text,fc,W-160,lang)
    lh=int(sz*1.42); tag=TAG[lang].get(role)
    bh=len(lines)*lh+60+(46 if tag else 0); y0=1300-bh//2 if bh<700 else 1000
    d.rounded_rectangle((40,y0,W-40,y0+bh),radius=26,fill=(20,16,24,190))
    y=y0+28
    if tag: ft=F(lang,30); d.text((80,y),tag,font=ft,fill=(240,190,80)); y+=46
    for l in lines: d.text(((W-d.textlength(l,font=fc))/2,y),l,font=fc,fill='white'); y+=lh
    if cta:
        fp=F(lang,40); c=CTA[lang]; tw=d.textlength(c,font=fp)
        d.rounded_rectangle(((W-tw)/2-40,1640,(W+tw)/2+40,1730),radius=45,fill=(220,30,40,235)); d.text(((W-tw)/2,1655),c,font=fp,fill='white')
    return im
def build(lang,s,out):
    L=D[lang][s]; tmp=f'/home/claude/mih/tmp/{lang}_{s}'; os.makedirs(tmp,exist_ok=True); parts=[]
    for i,(role,text,shot) in enumerate(L):
        wav=f'{O}/{lang}_{s}_l{i}.wav'
        if not os.path.exists(wav): raise SystemExit(f'missing {wav}')
        dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',wav]))+0.45
        bg=Image.open(pick(shot)).convert('RGB').resize((W,int(W*1344/768)))
        bg=bg.crop((0,(bg.height-H)//2,W,(bg.height-H)//2+H)); bg.save(f'{tmp}/bg{i}.jpg',quality=94)
        overlay(lang,s,role,text,i==len(L)-1).save(f'{tmp}/ov{i}.png')
        fr=int(dur*30); z=f"zoompan=z='1+0.07*on/{fr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fr}:s={W}x{H}:fps=30"
        o=f'{tmp}/s{i}.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-loop','1','-i',f'{tmp}/bg{i}.jpg','-i',f'{tmp}/ov{i}.png','-i',wav,'-filter_complex',
          f"[0:v]scale=1188:2112,{z}[b];[b][1:v]overlay=0:0,format=yuv420p[v];[2:a]aresample=44100,apad[a]",'-map','[v]','-map','[a]','-t',f'{dur:.2f}',
          '-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-b:a','160k','-ac','2',o],check=True); parts.append(o)
    open(f'{tmp}/l.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
    subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',f'{tmp}/l.txt','-c','copy','-movflags','+faststart',out],check=True)
if __name__=='__main__':
    os.makedirs('/home/claude/mih/out',exist_ok=True)
    for a in sys.argv[2:]:
        lang,s=a.split('_'); build(lang,s,f'/home/claude/mih/out/{s}_{lang}.mp4'); print(a,'ok')
