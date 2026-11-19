import json, os, sys, subprocess, asyncio
os.makedirs('out',exist_ok=True); mode=sys.argv[1]
D=json.load(open('gen/short.json')); lc,vm=D['V'][mode]
def post(raw,name,filt): subprocess.run(['ffmpeg','-v','error','-y','-i',raw,'-af',filt,'-ar','24000','-ac','1',f'out/{name}.wav'],check=True); os.remove(raw)
FL={'naomi':'asetrate=24000*0.97,aresample=24000,atempo=1.03,loudnorm=I=-16:TP=-1.5','mom':'loudnorm=I=-16:TP=-1.5','nar':'loudnorm=I=-16:TP=-1.5'}
if lc=='edge':
    import edge_tts
    async def go():
        for i,(r,t) in enumerate(D['L'][mode]):
            raw=f'out/{mode}_l{i}_raw.mp3'; await edge_tts.Communicate(t,vm[r],rate='-8%').save(raw); post(raw,f'{mode}_l{i}',FL[r]); print(mode,i,'ok')
    asyncio.run(go())
else:
    import soundfile as sf, numpy as np
    from kokoro import KPipeline
    pipe=KPipeline(lang_code=lc)
    for i,(r,t) in enumerate(D['L'][mode]):
        a=np.concatenate([au for _,_,au in pipe(t,voice=vm[r],speed=0.92)]); raw=f'out/{mode}_l{i}_raw.wav'; sf.write(raw,a,24000); post(raw,f'{mode}_l{i}',FL[r]); print(mode,i,'ok')
