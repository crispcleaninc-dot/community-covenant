import json, os, asyncio, edge_tts
L=json.load(open('gen/lines.json')); os.makedirs('out',exist_ok=True)
async def one(k,v,r,p,t):
    for a in range(4):
        try:
            await edge_tts.Communicate(t,v,rate=r,pitch=p).save(f'out/{k}.mp3'); print(k,'ok'); return
        except Exception as e: print(k,'err',e); await asyncio.sleep(3)
async def main():
    for x in L: await one(*x)
asyncio.run(main())
