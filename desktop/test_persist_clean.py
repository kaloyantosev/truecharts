import json
import urllib.request
import websocket

req = urllib.request.Request("http://localhost:9222/json", headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as res:
    tabs = json.loads(res.read().decode())

chart_tab = None
for tab in tabs:
    url = tab.get("url", "")
    if "tradingview.com/chart" in url:
        chart_tab = tab
        break

ws_url = chart_tab.get("webSocketDebuggerUrl")
ws = websocket.create_connection(ws_url, timeout=5)

js_expr = """
(function() {
    try {
        const cwc = window._exposed_chartWidgetCollection || window.chartWidgetCollection;
        const widget = cwc.activeChartWidget.value();
        const model = widget.model();
        const pane = model.panes()[0];
        
        let report = [];
        
        // 1. Create a line tool
        const line = model.createLineTool({
            pane: pane,
            point: { price: 205.0 },
            linetool: 'LineToolHorzLine'
        });
        
        if (line) {
            report.push("Line Created ID=" + line.id());
            
            // Inspect line object for state / symbol binding methods
            let lineKeys = Object.keys(line).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(line)));
            report.push("LineKeys: " + lineKeys.filter(k => k.toLowerCase().includes('symbol') || k.toLowerCase().includes('state') || k.toLowerCase().includes('save') || k.toLowerCase().includes('owner')).join(", "));
            
            if (line.properties && line.properties().symbol) {
                report.push("line.properties().symbol exists");
            }
        }
        
        return report.join(" | ");
    } catch(e) {
        return "ERR: " + e.message;
    }
})()
"""

payload = {"id": 1, "method": "Runtime.evaluate", "params": {"expression": js_expr, "returnByValue": True}}
ws.send(json.dumps(payload))
res = json.loads(ws.recv())
print("PERSIST CLEAN TEST RESULT:\n", res.get("result", {}).get("result", {}).get("value"))

ws.close()
