import os, shutil, time, traceback
from gradio_client import Client, handle_file
os.makedirs('out', exist_ok=True); log=[]
which=os.environ['W']
try:
    if which=='wan':
        for sp in ["zerogpu-aoti/wan2-2-fp8da-aoti-faster","r3gm/wan2-2-fp8da-aoti-preview2","zerogpu-aoti/wan2-2-fp8da-aoti"]:
            try:
                c=Client(sp); log.append(sp+' api: '+str(c.view_api(return_format='dict'))[:1500])
                r=c.predict(handle_file('gen/in.png'),"two men shaking hands and laughing warmly in a store aisle, natural subtle motion, cinematic",api_name="/generate_video")
                log.append('result '+str(r)[:300])
                f=r[0] if isinstance(r,(list,tuple)) else r
                if isinstance(f,dict): f=f.get('video') or f.get('path')
                shutil.copy(f,'out/wan.mp4'); log.append('ok '+sp); break
            except Exception as e: log.append(sp+' ERR '+traceback.format_exc()[-800:])
    else:
        for sp in ["facebook/MusicGen","sanchit-gandhi/musicgen-streaming"]:
            try:
                c=Client(sp); log.append(sp+' api: '+str(c.view_api(return_format='dict'))[:1500]); break
            except Exception as e: log.append(sp+' ERR '+str(e)[:300])
except Exception as e: log.append(traceback.format_exc())
open(f'out/log_{which}.txt','w').write('\n'.join(log)); print('\n'.join(log))
