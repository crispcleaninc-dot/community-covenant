import json, subprocess, os, urllib.request
B = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/sw/sw_CD/lanfrica/medium/'
for f in ['sw_CD-lanfrica-medium.onnx', 'sw_CD-lanfrica-medium.onnx.json', 'MODEL_CARD']:
    urllib.request.urlretrieve(B + f, f)
os.makedirs('out', exist_ok=True); open('out/MODEL_CARD.txt', 'w').write(open('MODEL_CARD').read())
T = json.load(open('tts/sw.json'))
for ep, lines in T.items():
    for i, t in enumerate(lines):
        for ls, tag in [(1.0, ''), (1.12, 's')]:
            subprocess.run(['piper', '-m', 'sw_CD-lanfrica-medium.onnx', '--length_scale', str(ls), '--sentence_silence', '0.25', '-f', f'out/{ep}_l{i}{tag}.wav'], input=t.encode(), check=True)
print(open('MODEL_CARD').read())
