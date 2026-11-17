import json, subprocess, os, urllib.request
J = json.load(open('job/piper_job.json')); os.makedirs('out', exist_ok=True)
H = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/'
V = {'tom': 'fr/fr_FR/tom/medium/fr_FR-tom-medium', 'gilles': 'fr/fr_FR/gilles/low/fr_FR-gilles-low',
     'upmc': 'fr/fr_FR/upmc/medium/fr_FR-upmc-medium', 'sw': 'sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium'}
for k, p in V.items():
    for ext in ['.onnx', '.onnx.json']: urllib.request.urlretrieve(H + p + ext, k + ext)
FR = {'am_onyx': ('tom', None, 1.0), 'am_fenrir': ('gilles', None, 1.08), 'am_michael': ('upmc', '1', 1.0)}
for i, r in enumerate(J['roles']):
    if r in FR:
        m, spk, ls = FR[r]; cmd = ['piper', '-m', m + '.onnx', '--length_scale', str(ls), '-f', f'out/fr_{i}.wav']
        if spk: cmd += ['--speaker', spk]
        subprocess.run(cmd, input=J['fr'][i].encode(), check=True)
    ls = {'am_fenrir': 1.12, 'af_heart': 1.0}.get(r, 1.02)
    subprocess.run(['piper', '-m', 'sw.onnx', '--length_scale', str(ls), '-f', f'out/sw_{i}.wav'], input=J['sw'][i].encode(), check=True)
print('tts done')
