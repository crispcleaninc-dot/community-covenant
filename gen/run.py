import json, os, time, shutil
from gradio_client import Client
P = json.load(open('gen/prompts.json')); os.makedirs('gen/out2', exist_ok=True); log = []
c = Client("black-forest-labs/FLUX.1-schnell")
only=os.environ.get('SHOTS','').split(',')
for sid, seeds, p in P['shots']:
    if only != [''] and sid not in only: continue
    p = p.replace('{who}', P['who']) + P['style']
    for sd in seeds:
        for a in range(3):
            try:
                r = c.predict(prompt=p, seed=sd, randomize_seed=False, width=768, height=1344, num_inference_steps=4, api_name="/infer")
                f = r[0] if isinstance(r, (list, tuple)) else r
                shutil.copy(f, f'gen/out2/{sid}_{sd}.webp'); log.append(f'{sid}_{sd} ok'); break
            except Exception as e:
                log.append(f'{sid}_{sd} try{a} {str(e)[:200]}'); time.sleep(20)
open('gen/out2/log.txt', 'w').write('\n'.join(log))
