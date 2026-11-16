import json, urllib.request, urllib.parse, time, os
P = json.load(open('gen/prompts.json')); os.makedirs('gen/out', exist_ok=True); log = []
for sid, seeds, p in P['shots']:
    p = p.replace('{who}', P['who']) + P['style']
    for sd in seeds:
        url = 'https://image.pollinations.ai/prompt/' + urllib.parse.quote(p) + f'?width=768&height=1344&seed={sd}&model=flux&nologo=true&private=true'
        for a in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=180) as r: b = r.read()
                if len(b) < 20000: raise Exception('small %d' % len(b))
                open(f'gen/out/{sid}_{sd}.jpg', 'wb').write(b); log.append(f'{sid}_{sd} ok {len(b)}'); break
            except Exception as e:
                log.append(f'{sid}_{sd} try{a} {e}'); time.sleep(20)
        time.sleep(12)
open('gen/out/log.txt', 'w').write('\n'.join(log))
