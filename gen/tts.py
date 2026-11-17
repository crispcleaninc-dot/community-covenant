import json, os, sys, subprocess, numpy as np, soundfile as sf
from kokoro import KPipeline
folder, voice, speed, script, filt = sys.argv[1:6]
T = json.load(open('gen/texts.json')); base = T['base']; texts = T[script]
os.makedirs('out/' + folder, exist_ok=True)
pipe = KPipeline(lang_code='b' if voice.startswith('b') else 'a')
for i, t in enumerate(texts):
    a = np.concatenate([au for _, _, au in pipe(t, voice=voice, speed=float(speed))])
    sf.write('tmp.wav', a, 24000)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'tmp.wav', '-af', filt, '-ar', '24000', '-ac', '1', '-b:a', '48k', f'out/{folder}/{base + i}.mp3'], check=True)
print(folder, 'done', len(texts))
