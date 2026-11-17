import json, os, traceback
os.makedirs('out', exist_ok=True)
try:
  import soundfile as sf, numpy as np
  from kokoro import KPipeline
except Exception:
  open('out/err.txt','w').write(traceback.format_exc()); raise
S = json.load(open('gen/story.json')); os.makedirs('out', exist_ok=True)
pipe = KPipeline(lang_code='a')
for sid, _, lines in S:
    for i, (v, t) in enumerate(lines):
        sp = 0.92 if v in ('am_fenrir',) else 0.95
        a = np.concatenate([au for _, _, au in pipe(t, voice=v, speed=sp)])
        sf.write(f'out/{sid}_l{i}.wav', a, 24000)
print('done')
