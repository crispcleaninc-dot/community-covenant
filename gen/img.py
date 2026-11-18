import json, os, time, shutil
from gradio_client import Client
S = dict(json.load(open('gen/shots.json'))); sid = os.environ['SHOT']
p = S[sid] + ", photorealistic cinematic film still, shot on 35mm, natural skin texture, realistic proportions, realistic hands, shallow depth of field, natural lighting, Detroit, high detail, no text"
os.makedirs('out', exist_ok=True); log = []
c = None
for a in range(5):
    try: c = Client("black-forest-labs/FLUX.1-schnell"); break
    except Exception as e: log.append('client ' + str(e)[:200]); time.sleep(30)
for sd in [5101, 5102]:
    for a in range(4):
        try:
            r = c.predict(prompt=p, seed=sd, randomize_seed=False, width=768, height=1344, num_inference_steps=4, api_name="/infer")
            f = r[0] if isinstance(r, (list, tuple)) else r
            shutil.copy(f, f'out/{sid}_{sd}.webp'); log.append(f'{sid}_{sd} ok'); break
        except Exception as e:
            log.append(f'{sid}_{sd} try{a} {str(e)[:200]}'); time.sleep(40)
open(f'out/{sid}_log.txt', 'w').write('\n'.join(log)); print('\n'.join(log))
