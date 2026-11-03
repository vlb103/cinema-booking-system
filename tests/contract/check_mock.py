# Replays positive and negative scenarios from the table against the Prism mock on localhost:4010
import re,sys,json,urllib.request,urllib.error
sys.stdout.reconfigure(encoding='utf-8')
rows=[l for l in open(sys.argv[1],encoding='utf-8') if re.match(r'\| [PN]-\d+',l)]
ok=0;res=[]
for l in rows:
    c=[x.strip() for x in l.strip().strip('|').split('|')]
    sid,req,tok,body,code,ecode,mock=c[0],c[4].strip('`'),c[5],c[6],c[7],c[8],c[9]
    m,path=req.split(' ',1)
    h={'Content-Type':'application/json'}
    if tok.startswith('Так'): h['Authorization']='Bearer user-token'
    pm=re.search(r'Prefer: ([^`]+)',mock)
    if pm: h['Prefer']=pm.group(1)
    data=body.strip('`').encode() if body not in ('—','') else None
    r=urllib.request.Request('http://localhost:4010'+path,data=data,headers=h,method=m)
    try:
        resp=urllib.request.urlopen(r); st=resp.status; txt=resp.read().decode()
    except urllib.error.HTTPError as e: st=e.code; txt=e.read().decode()
    got=''
    try: got=json.loads(txt).get('code','') if isinstance(json.loads(txt),dict) else ''
    except Exception: pass
    exp_code=ecode if re.fullmatch(r'[A-Z_]+',ecode) else ''
    good = str(st)==code and (not exp_code or got==exp_code)
    ok+=good; res.append(f"{sid} {m} {path} -> {st} {got} {'OK' if good else 'FAIL expected '+code+' '+exp_code}")
print('\n'.join(res)); print(f'TOTAL {ok}/{len(rows)} scenarios match the contract')
