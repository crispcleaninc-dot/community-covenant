import os, json, shutil, time, traceback
from gradio_client import Client, handle_file
T=json.load(open('gen/tasks.json'))[int(os.environ['I'])]
os.makedirs('out',exist_ok=True); log=[]
def save(r,name):
    f=r[0] if isinstance(r,(list,tuple)) else r
    if isinstance(f,dict): f=f.get('video') or f.get('path') or f.get('value')
    shutil.copy(f,name)
try:
    if 'music' in T:
        ok=False
        for sp in ["ACE-Step/ACE-Step","Surn/UnlimitedMusicGen","facebook/MusicGen"]:
            if ok: break
            try:
                c=Client(sp); api=c.view_api(return_format='dict')['named_endpoints']
                log.append(sp+' endpoints '+str({k:[p['parameter_name'] for p in v['parameters']] for k,v in api.items()})[:3000])
                if sp=="ACE-Step/ACE-Step":
                    ep=[k for k in api if 'text2music' in k or k=='/__call__']
                    ep=ep[0] if ep else list(api)[0]
                    names=[p['parameter_name'] for p in api[ep]['parameters']]
                    kw={}
                    for p in api[ep]['parameters']:
                        n=p['parameter_name']
                        if 'duration' in n: kw[n]=90
                        elif n in ('prompt','tags'): kw[n]=T['music']+', instrumental'
                        elif 'lyric' in n: kw[n]='[instrumental]'
                    r=c.predict(**kw,api_name=ep)
                else:
                    r=c.predict(T['music'],None,api_name=list(api)[0])
                log.append('res '+str(r)[:300])
                f=r[0] if isinstance(r,(list,tuple)) else r
                if isinstance(f,(list,tuple)): f=f[0]
                if isinstance(f,dict): f=f.get('path') or f.get('value')
                ext=os.path.splitext(str(f))[1] or '.wav'
                shutil.copy(f,f"out/{T['id']}_0{ext}"); log.append('ok '+sp); ok=True
            except Exception as e: log.append(sp+' err '+traceback.format_exc()[-600:])
    else:
        c=Client("zerogpu-aoti/wan2-2-fp8da-aoti-faster")
        api=c.view_api(return_format='dict')['named_endpoints']['/generate_video']['parameters']
        names=[p['parameter_name'] for p in api]; log.append('params '+str(names))
        kw={'input_image':handle_file(T['img']),'prompt':T['prompt']}
        for n in names:
            if 'duration' in n: kw[n]=3.0
        for a in range(4):
            try:
                r=c.predict(**kw,api_name="/generate_video"); save(r,f"out/{T['id']}.mp4"); log.append('ok'); break
            except Exception as e:
                log.append('err '+str(e)[:300])
                if 'duration' in str(e).lower() or 'invalid' in str(e).lower():
                    kw={k:v for k,v in kw.items() if 'duration' not in k}
                time.sleep(45)
except Exception: log.append(traceback.format_exc()[-1500:])
open(f"out/log_{T['id']}.txt",'w').write('\n'.join(log)); print('\n'.join(log))
