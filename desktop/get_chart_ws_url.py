import json
import urllib.request

req = urllib.request.Request("http://localhost:9222/json", headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=2) as res:
    tabs = json.loads(res.read().decode())

chart_tab = None
for tab in tabs:
    url = tab.get("url", "")
    if "tradingview.com/chart" in url:
        chart_tab = tab
        break

print("CHART TAB:", chart_tab.get("title") if chart_tab else "None")
print("WS URL:", chart_tab.get("webSocketDebuggerUrl") if chart_tab else "None")
