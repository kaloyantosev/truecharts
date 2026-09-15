import urllib.request
import json

req = urllib.request.Request("http://127.0.0.1:9222/json", headers={'User-Agent': 'Mozilla/5.0', 'Host': '127.0.0.1:9222'})
with urllib.request.urlopen(req, timeout=3) as res:
    data = json.loads(res.read().decode())

print("SUCCESS 127.0.0.1! TABS COUNT:", len(data))
