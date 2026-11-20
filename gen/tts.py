import json, os, sys, subprocess, traceback, asyncio
lang=sys.argv[1]; D=json.load(open('gen/lines.json'))[lang]; os.makedirs('out',exist_ok=True)
N='loudnorm=I=-16:TP=-1.5'
P=lambda r,t: f'asetrate=24000*{r},aresample=24000,atempo={t},'+N
KIDF={'jojo':P(1.08,0.95),'pip':P(1.2,0.87)}
V={'en':('a',{'nar':('af_nicole,af_heart',0.92,N),'mom':('af_heart',0.93,N),'jojo':('am_puck',1.0,P(1.06,0.95)),'pip':('af_sky',1.0,P(1.22,0.86))}),
   'es':('e',{'nar':('em_alex',0.92,N),'mom':('ef_dora',0.92,N),'jojo':('ef_dora',1.0,KIDF['jojo']),'pip':('ef_dora',1.0,KIDF['pip'])}),
   'fr':('f',{'nar':('ff_siwis',0.92,P(0.9,1.08)),'mom':('ff_siwis',0.92,N),'jojo':('ff_siwis',1.0,KIDF['jojo']),'pip':('ff_siwis',1.0,KIDF['pip'])}),
   'hi':('h',{'nar':('hm_omega',0.92,N),'mom':('hf_beta',0.92,N),'jojo':('hf_alpha',1.0,KIDF['jojo']),'pip':('hf_alpha',1.0,KIDF['pip'])}),
   'zh':('z',{'nar':('zm_yunjian',0.92,N),'mom':('zf_xiaoxiao',0.92,N),'jojo':('zf_xiaoyi',1.0,KIDF['jojo']),'pip':('zf_xiaoyi',1.0,KIDF['pip'])}),
   'ar':('edge',{'nar':('ar-EG-ShakirNeural',0,N),'mom':('ar-EG-SalmaNeural',0,N),'jojo':('ar-EG-SalmaNeural',0,P(1.08,0.95)),'pip':('ar-EG-SalmaNeural',0,P(1.2,0.87))})}
lc,vm=V[lang]
def post(raw,name,f):
    subprocess.run(['ffmpeg','-v','error','-y','-i',raw,'-af',f,'-ar','24000','-ac','1',f'out/{name}.wav'],check=True); os.remove(raw)
items=[(s,i,r,t) for s,L in D.items() for i,(r,t,_) in enumerate(L)]
if lc=='edge':
    import edge_tts
    async def go():
        for s,i,r,t in items:
            v,_,f=vm[r]; raw=f'out/{lang}_{s}_l{i}_raw.mp3'
            try: await edge_tts.Communicate(t,v,rate='-8%').save(raw); post(raw,f'{lang}_{s}_l{i}',f); print(lang,s,i,'ok')
            except Exception: print(lang,s,i,'FAIL',traceback.format_exc()[-300:])
    asyncio.run(go())
else:
    import soundfile as sf, numpy as np
    from kokoro import KPipeline
    pipe=KPipeline(lang_code=lc)
    for s,i,r,t in items:
        v,sp,f=vm[r]; raw=f'out/{lang}_{s}_l{i}_raw.wav'
        try:
            a=np.concatenate([au for _,_,au in pipe(t,voice=v,speed=sp)]); sf.write(raw,a,24000); post(raw,f'{lang}_{s}_l{i}',f); print(lang,s,i,'ok')
        except Exception: print(lang,s,i,'FAIL',traceback.format_exc()[-300:])
