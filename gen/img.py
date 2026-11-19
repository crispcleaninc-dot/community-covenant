import json, os, time, shutil
from gradio_client import Client
S = {s[0]:s for s in json.load(open('gen/shots.json'))}
G = json.load(open('gen/groups.json'))[int(os.environ['G'])]
os.makedirs('out', exist_ok=True); log = []
c = None
for a in range(5):
    try: c = Client("black-forest-labs/FLUX.1-schnell"); break
    except Exception as e: log.append('client ' + str(e)[:200]); time.sleep(30)
for sid in G:
    _, p, w, h = S[sid]
    p = p + ", photorealistic cinematic film still, shot on 35mm, natural skin texture, realistic proportions, realistic hands, shallow depth of field, natural lighting, high detail, no text, no watermark"
    for a in range(4):
        try:
            r = c.predict(prompt=p, seed=7400+int(os.environ['G']), randomize_seed=False, width=w, height=h, num_inference_steps=4, api_name="/infer")
            f = r[0] if isinstance(r, (list, tuple)) else r
            shutil.copy(f, f"out/{sid}_{os.environ['G']}.webp"); log.append(f'{sid} ok'); break
        except Exception as e:
            log.append(f'{sid} try{a} {str(e)[:200]}'); time.sleep(40)
open(f'out/log_{os.environ["G"]}.txt', 'w').write('\n'.join(log)); print('\n'.join(log))
