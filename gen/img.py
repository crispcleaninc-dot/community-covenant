import json, os, time, shutil
from gradio_client import Client
sid=os.environ['SHOT']
STYLE=", photorealistic cinematic film still, shot on 35mm, natural skin texture, realistic proportions, realistic hands, shallow depth of field, warm natural cinematic lighting, gentle color grade, high detail, no text, no words, no letters"
if sid.startswith('v'):
    p=dict(json.load(open('gen/vert.json')))[sid]; W,H=768,1344
else:
    p=[s for s in json.load(open('gen/story.json')) if s[0]==sid][0][1]; W,H=1344,768
p+=STYLE; os.makedirs('out',exist_ok=True); log=[]
c=None
for a in range(6):
    try: c=Client("black-forest-labs/FLUX.1-schnell"); break
    except Exception as e: log.append('client '+str(e)[:200]); time.sleep(30)
for sd in [7301,7302]:
    for a in range(4):
        try:
            r=c.predict(prompt=p,seed=sd,randomize_seed=False,width=W,height=H,num_inference_steps=4,api_name="/infer")
            f=r[0] if isinstance(r,(list,tuple)) else r
            shutil.copy(f,f'out/{sid}_{sd}.webp'); log.append(f'{sid}_{sd} ok'); break
        except Exception as e:
            log.append(f'{sid}_{sd} try{a} {str(e)[:200]}'); time.sleep(45)
open(f'out/{sid}_log.txt','w').write('\n'.join(log)); print('\n'.join(log))
