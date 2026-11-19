import json, os, sys, subprocess, traceback
import soundfile as sf, numpy as np
from kokoro import KPipeline
os.makedirs('out',exist_ok=True)
mode=sys.argv[1]
def save(a,name,filt):
    raw=f'out/{name}_raw.wav'; sf.write(raw,a,24000)
    subprocess.run(['ffmpeg','-v','error','-y','-i',raw,'-af',filt,'-ar','24000','-ac','1',f'out/{name}.wav'],check=True); os.remove(raw)
def gen(pipe,t,v,sp):
    return np.concatenate([au for _,_,au in pipe(t,voice=v,speed=sp)])
if mode=='en':
    S=json.load(open('gen/story.json')); pipe=KPipeline(lang_code='a')
    VM={'nar':('af_nicole,af_heart',0.92,'loudnorm=I=-16:TP=-1.5'),
        'mom':('af_heart',0.93,'loudnorm=I=-16:TP=-1.5'),
        'jojo':('am_puck',1.0,'asetrate=24000*1.06,aresample=24000,atempo=0.95,loudnorm=I=-16:TP=-1.5'),
        'pip':('af_sky',1.0,'asetrate=24000*1.22,aresample=24000,atempo=0.86,loudnorm=I=-16:TP=-1.5'),
        'grandpa':('am_onyx',0.88,'asetrate=24000*0.94,aresample=24000,atempo=1.03,loudnorm=I=-16:TP=-1.5'),
        'naomi':('af_sarah',0.9,'asetrate=24000*0.97,aresample=24000,atempo=1.02,loudnorm=I=-16:TP=-1.5'),
        'officer':('am_michael',1.0,'loudnorm=I=-16:TP=-1.5')}
    for sid,_,lines in S:
        for i,(r,t) in enumerate(lines):
            name=f'{sid}_l{i}'
            try:
                if r=='all':
                    parts=[]
                    for rr in ('mom','jojo','pip'):
                        v,sp,f=VM[rr]; save(gen(pipe,t,v,sp),f'{name}_{rr}',f)
                    subprocess.run(['ffmpeg','-v','error','-y','-i',f'out/{name}_mom.wav','-i',f'out/{name}_jojo.wav','-i',f'out/{name}_pip.wav','-filter_complex','amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5','-ar','24000','-ac','1',f'out/{name}.wav'],check=True)
                    for rr in ('mom','jojo','pip'): os.remove(f'out/{name}_{rr}.wav')
                else:
                    v,sp,f=VM[r]; save(gen(pipe,t,v,sp),name,f)
                print(name,'ok')
            except Exception: print(name,'FAIL',traceback.format_exc()[-400:])
else:
    D=json.load(open('gen/short.json')); lc,vm=D['V'][mode]
    pipe=KPipeline(lang_code=lc)
    FL={'naomi':'asetrate=24000*0.95,aresample=24000,atempo=1.04,loudnorm=I=-16:TP=-1.5','mom':'loudnorm=I=-16:TP=-1.5','nar':'loudnorm=I=-16:TP=-1.5'}
    if mode=='fr': FL['nar']='asetrate=24000*0.9,aresample=24000,atempo=1.08,loudnorm=I=-16:TP=-1.5'
    for i,(r,t) in enumerate(D['L'][mode]):
        try: save(gen(pipe,t,vm[r],0.92),f'{mode}_l{i}',FL[r]); print(mode,i,'ok')
        except Exception: print(mode,i,'FAIL',traceback.format_exc()[-400:])
