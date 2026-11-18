import re
import os
import sys
import json
import time
import datetime
import calendar
import urllib.request
import urllib.parse
import threading
import subprocess
import socket
from concurrent.futures import ThreadPoolExecutor
import requests
import tkinter as tk
from tkinter import ttk, messagebox
import websocket

# Set UTF-8 encoding for standard output
sys.stdout.reconfigure(encoding='utf-8')

class TradingViewAutomatorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TrueCharts - TradingView Desktop Auto-Level Injector")
        self.root.geometry("880x560")
        self.root.minsize(700, 480)
        self.root.configure(bg="#0f172a")
        
        # Load Application Icon if available
        try:
            ico_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app_icon.ico')
            if os.path.exists(ico_path):
                self.root.iconbitmap(ico_path)
        except Exception:
            pass

        self.api_url = "https://truecharts.onrender.com/api/analyze"
        self.vercel_url = "https://truecharts-chi.vercel.app"
        self.is_tracking = False
        self.sync_active = False
        self.current_ticker = None
        self.tv_ws_url = None
        self.sinclair_cache = {}
        self.dom_cache = {}
        self.dom_cache_time = {}
        self.gamma_cache = {}  # ticker -> gamma flip of the last full level draw (for line refreshes)
        # Shared level/scenario engine (same file the backtester site imports). Injected into the chart page.
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "tc_engine.js"), encoding="utf-8") as f:
            self.engine_js = f.read()
        self.engine_version = re.search(r'VERSION:\s*"([^"]+)"', self.engine_js).group(1)
        self.snapshot_dir = os.path.join(here, "data_log")
        self.snapshot_time = {}  # ticker -> last chain snapshot written (rate limit)
        self._monitor_tick = 0
        self._last_draw = 0
        self._http_session = requests.Session()
        self._http_session.headers.update({'User-Agent': 'Mozilla/5.0'})

        self.setup_ui()
        
        # Start background threads
        self.start_backend_health_check()
        self.start_tv_status_monitor()

    def setup_ui(self):
        # Header Bar
        header_frame = tk.Frame(self.root, bg="#0f172a")
        header_frame.pack(fill="x", padx=15, pady=(10, 5))
        
        title_label = tk.Label(
            header_frame,
            text="TrueCharts Level Injector",
            font=("Segoe UI", 15, "bold"),
            bg="#0f172a",
            fg="#38bdf8"
        )
        title_label.pack(side="left")

        # Horizontal PanedWindow (Left: Controls | Right: Draggable Live Console Log)
        paned = tk.PanedWindow(
            self.root,
            orient="horizontal",
            sashrelief="raised",
            sashwidth=5,
            bg="#1e293b",
            bd=0
        )
        paned.pack(fill="both", expand=True, padx=12, pady=(5, 12))

        # Left Column: Status Rows & Tracking Controls
        left_col = tk.Frame(paned, bg="#0f172a", width=380)
        left_col.pack_propagate(False)

        # 1. Render API Status Row
        api_frame = tk.Frame(left_col, bg="#1e293b", relief="ridge", bd=1)
        api_frame.pack(fill="x", padx=6, pady=4)

        self.api_dot = tk.Canvas(api_frame, width=12, height=12, bg="#1e293b", highlightthickness=0)
        self.api_dot.pack(side="left", padx=(10, 5), pady=8)
        self.draw_dot(self.api_dot, "gray")

        self.api_status_lbl = tk.Label(
            api_frame,
            text="Render Server: Checking status...",
            font=("Segoe UI", 9, "bold"),
            bg="#1e293b",
            fg="#94a3b8"
        )
        self.api_status_lbl.pack(side="left", padx=5)

        self.wake_btn = tk.Button(
            api_frame,
            text="Wake Up",
            font=("Segoe UI", 8, "bold"),
            bg="#3b82f6",
            fg="#ffffff",
            activebackground="#2563eb",
            bd=0,
            padx=8,
            pady=3,
            command=self.wake_up_backend
        )
        self.wake_btn.pack(side="right", padx=8)

        # 2. TradingView App Status Row
        tv_status_frame = tk.Frame(left_col, bg="#1e293b", relief="ridge", bd=1)
        tv_status_frame.pack(fill="x", padx=6, pady=4)

        self.tv_dot = tk.Canvas(tv_status_frame, width=12, height=12, bg="#1e293b", highlightthickness=0)
        self.tv_dot.pack(side="left", padx=(10, 5), pady=8)
        self.draw_dot(self.tv_dot, "red")

        self.tv_status_lbl = tk.Label(
            tv_status_frame,
            text="TradingView: Disconnected",
            font=("Segoe UI", 9, "bold"),
            bg="#1e293b",
            fg="#ef4444"
        )
        self.tv_status_lbl.pack(side="left", padx=5)

        # Tracking Controls Frame (Clean: only Start Ticker and Mount Options DOM)
        control_frame = tk.LabelFrame(
            left_col,
            text=" Tracking Controls ",
            font=("Segoe UI", 10, "bold"),
            bg="#0f172a",
            fg="#e2e8f0",
            padx=12,
            pady=12
        )
        control_frame.pack(fill="x", padx=6, pady=8)

        self.track_btn = tk.Button(
            control_frame,
            text="Start Ticker Tracker (Auto-Draw)",
            font=("Segoe UI", 11, "bold"),
            bg="#10b981",
            fg="#ffffff",
            activebackground="#059669",
            bd=0,
            padx=15,
            pady=10,
            command=self.toggle_tracking
        )
        self.track_btn.pack(fill="x", pady=(4, 8))

        self.dom_btn = tk.Button(
            control_frame,
            text="📊 Mount Options DOM",
            font=("Segoe UI", 10, "bold"),
            bg="#0d9488",
            fg="#ffffff",
            activebackground="#0f766e",
            bd=0,
            padx=10,
            pady=8,
            command=self.mount_options_dom_btn_click
        )
        self.dom_btn.pack(fill="x", pady=(0, 4))
        self.hud_btn = self.dom_btn

        # Dummy references for backward compatibility with background methods
        self.sync_btn = tk.Button(self.root)
        self.clear_red_btn = tk.Button(self.root)
        self.sync_indexes_btn = tk.Button(self.root)
        self.clear_indexes_btn = tk.Button(self.root)
        self.sync_fav_btn = tk.Button(self.root)
        self.clear_fav_btn = tk.Button(self.root)

        # Status Bar
        self.status_lbl = tk.Label(
            left_col,
            text="Status: Ready",
            font=("Segoe UI", 9, "italic"),
            bg="#0f172a",
            fg="#94a3b8"
        )
        self.status_lbl.pack(anchor="w", padx=8, pady=(4, 2))

        # Right Column: Resizable Live Activity Console Log
        right_col = tk.LabelFrame(
            paned,
            text=" Live Activity Console Log ",
            font=("Segoe UI", 9, "bold"),
            bg="#0f172a",
            fg="#e2e8f0",
            width=460
        )
        right_col.pack_propagate(False)

        self.log_text = tk.Text(
            right_col,
            bg="#020617",
            fg="#22c55e",
            insertbackground="white",
            font=("Consolas", 9),
            bd=0,
            wrap="word"
        )
        self.log_text.pack(side="left", fill="both", expand=True, padx=5, pady=5)

        scrollbar = tk.Scrollbar(right_col, command=self.log_text.yview)
        scrollbar.pack(side="right", fill="y")
        self.log_text.config(yscrollcommand=scrollbar.set)

        paned.add(left_col, minsize=280)
        paned.add(right_col, minsize=240)

    def draw_dot(self, canvas, color):
        canvas.delete("all")
        hex_color = {"green": "#22c55e", "yellow": "#eab308", "red": "#ef4444", "gray": "#64748b"}.get(color, color)
        canvas.create_oval(1, 1, 11, 11, fill=hex_color, outline="")

    def log(self, msg):
        timestamp = time.strftime("[%H:%M:%S]")
        formatted_msg = f"{timestamp}  {msg}\n"
        self.log_text.insert("end", formatted_msg)
        self.log_text.see("end")

    def start_backend_health_check(self):
        def check():
            backend_root = self.api_url.replace("/api/analyze", "")
            while True:
                try:
                    req = urllib.request.Request(f"{backend_root}/", headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=8) as res:
                        if res.status == 200:
                            self.root.after(0, lambda: self.update_api_status("Active", "green"))
                        else:
                            self.root.after(0, lambda: self.update_api_status("Sleeping", "yellow"))
                except Exception:
                    self.root.after(0, lambda: self.update_api_status("Sleeping", "yellow"))
                time.sleep(15)

        t = threading.Thread(target=check, daemon=True)
        t.start()

    def update_api_status(self, text, color):
        self.draw_dot(self.api_dot, color)
        self.api_status_lbl.configure(text=f"Render Server: {text}", fg={"green": "#22c55e", "yellow": "#eab308", "red": "#ef4444"}[color])

    def wake_up_backend(self):
        self.log("Sending ping to wake up Render backend...")
        self.update_api_status("Waking up...", "yellow")
        backend_root = self.api_url.replace("/api/analyze", "")
        
        def ping():
            try:
                req = urllib.request.Request(f"{backend_root}/", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=60) as res:
                    if res.status == 200:
                        self.log("Backend server woke up successfully!")
                        self.root.after(0, lambda: self.update_api_status("Active", "green"))
            except Exception as e:
                self.log(f"Backend ping completed: {e}")

        threading.Thread(target=ping, daemon=True).start()

    # --- LIVE TRADINGVIEW DESKTOP STATUS MONITOR ---
    def start_tv_status_monitor(self):
        def monitor():
            while True:
                try:
                    req = urllib.request.Request("http://127.0.0.1:9222/json", headers={'User-Agent': 'Mozilla'})
                    with urllib.request.urlopen(req, timeout=3) as res:
                        tabs = json.loads(res.read().decode())
                    
                    chart_tab = None
                    for t in tabs:
                        if "tradingview.com/chart" in t.get("url", ""):
                            chart_tab = t
                            break
                    
                    self._monitor_tick += 1
                    if chart_tab:
                        self.tv_ws_url = chart_tab.get("webSocketDebuggerUrl")
                        title = chart_tab.get("title", "Active Chart")
                        if len(title) > 25:
                            title = "Active Chart"
                        self.root.after(0, lambda: self.update_tv_status(f"Connected ({title})", "green"))
                        if self._monitor_tick % 15 == 0:
                            self.ensure_sinclair_hud_mounted(self.tv_ws_url)
                    else:
                        self.tv_ws_url = None
                        self.root.after(0, lambda: self.update_tv_status("App Open (No Chart Tab)", "yellow"))
                except Exception:
                    self.tv_ws_url = None
                    self.root.after(0, lambda: self.update_tv_status("Disconnected (Port 9222 Offline)", "red"))
                
                time.sleep(1.5)

        threading.Thread(target=monitor, daemon=True).start()

    def update_tv_status(self, text, color):
        self.draw_dot(self.tv_dot, color)
        self.tv_status_lbl.configure(
            text=f"TradingView Desktop: {text}",
            fg={"green": "#22c55e", "yellow": "#eab308", "red": "#ef4444"}[color]
        )

    def mount_sinclair_hud_btn_click(self):
        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return
        res = self.ensure_sinclair_hud_mounted(self.tv_ws_url, force_render=True)
        self.log(f"Unified DOM (with top Sinclair metrics) mounted/refreshed on active TradingView chart! ({res})")

    def mount_options_dom_btn_click(self):
        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return
        active_sym = self.fetch_current_ticker_from_chart(self.tv_ws_url) or self.current_ticker or "SPY"
        
        def do_mount():
            self.log(f"Fetching real market options DOM (0DTE & Weekly) for {active_sym}...")
            dom_data = self.fetch_real_weekly_dom(active_sym, max_strikes=34)
            has_data = bool(dom_data and ((isinstance(dom_data, dict) and (dom_data.get("0dte") or dom_data.get("weekly"))) or (isinstance(dom_data, list) and len(dom_data) > 0)))
            self.dom_cache[active_sym] = dom_data
            self.dom_cache_time[active_sym] = time.time()
            res = self.ensure_options_dom_mounted(self.tv_ws_url, active_sym, dom_data, force_render=True)
            self.refresh_wall_lines(self.tv_ws_url, active_sym, dom_data)  # keep the wall lines on the same chain as the DOM
            if has_data:
                cnt_0 = len(dom_data.get("0dte", [])) if isinstance(dom_data, dict) else len(dom_data)
                cnt_w = len(dom_data.get("weekly", [])) if isinstance(dom_data, dict) else len(dom_data)
                self.log(f"Options DOM updated on chart for {active_sym} (0DTE: {cnt_0}, Weekly: {cnt_w} strikes)! ({res})")
            else:
                self.log(f"Options DOM mounted for {active_sym} (Not Available state rendered). ({res})")

        threading.Thread(target=do_mount, daemon=True).start()

    def execute_cdp_command(self, ws_url, js_code, timeout=5):
        if not ws_url:
            return None
        try:
            ws = websocket.create_connection(ws_url, timeout=timeout)
            payload = {
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": js_code,
                    "returnByValue": True,
                    # Many injected scripts are async IIFEs. Without awaitPromise the result is the
                    # unresolved Promise (serialised as {}), so their return values were lost.
                    "awaitPromise": True
                }
            }
            ws.send(json.dumps(payload))
            res = json.loads(ws.recv())
            ws.close()
            return res.get("result", {}).get("result", {}).get("value")
        except Exception as e:
            return f"CDP_ERR: {e}"

    # Display tickers that need a different symbol on Yahoo Finance.
    YAHOO_ALIASES = {"NIKKEI": "^N225", "NI225": "^N225", "RUSSELL": "^RUT", "RUT": "^RUT", "BRKB": "BRK-B", "BFB": "BF-B"}

    @staticmethod
    def clean_symbol(raw):
        """'NASDAQ:AAPL' -> 'AAPL', 'TVC:NI225' -> 'NI225'. Keeps digits (same rule as the in-chart JS)."""
        if not raw or not isinstance(raw, str):
            return None
        clean = re.sub(r'[^A-Z0-9]', '', raw.split(":")[-1].strip().upper())
        return clean or None

    def yahoo_symbol(self, ticker):
        return self.YAHOO_ALIASES.get(ticker, ticker)

    def ensure_options_dom_mounted(self, ws_url, sym, dom_data, force_render=False):
        if not ws_url:
            return False
        js = f"""
        (function() {{
            try {{
                // Remove legacy standalone Sinclair HUD if present
                const oldHud = document.getElementById('tc-sinclair-hud');
                if (oldHud) oldHud.remove();

                let domEl = document.getElementById('tc-options-dom');
                const force = {json.dumps(force_render)};
                if (domEl && !force) return "ALREADY_MOUNTED";

                const currentSym = "{sym}".toUpperCase();
                const rawData = {json.dumps(dom_data)};

                window._tc_dom_cache = window._tc_dom_cache || {{}};
                try {{
                    if (Object.keys(window._tc_dom_cache).length === 0) {{
                        const saved = localStorage.getItem('tc_dom_cache');
                        if (saved) window._tc_dom_cache = JSON.parse(saved);
                    }}
                }} catch(e) {{}}

                if (rawData && ((Array.isArray(rawData) && rawData.length > 0) || (typeof rawData === 'object' && ((rawData['0dte'] && rawData['0dte'].length > 0) || (rawData.weekly && rawData.weekly.length > 0))))) {{
                    window._tc_dom_cache[currentSym] = rawData;
                    try {{
                        localStorage.setItem('tc_dom_cache', JSON.stringify(window._tc_dom_cache));
                    }} catch(e) {{}}
                }}

                window._tc_dom_mode = window._tc_dom_mode || localStorage.getItem('tc_dom_mode') || 'weekly';

                if (!domEl) {{
                    domEl = document.createElement('div');
                    domEl.id = 'tc-options-dom';
                    domEl.style.cssText = 'position:fixed;z-index:999998;left:55px;top:60px;background:rgba(10,12,20,0.96);border:1px solid #1e293b;border-left:3px solid #0d9488;border-radius:6px;padding:9px 12px;color:#f8fafc;font-family:Consolas,monospace;font-size:10.5px;line-height:1.3;box-shadow:0 10px 30px rgba(0,0,0,0.75);pointer-events:auto;user-select:none;backdrop-filter:blur(10px);width:380px;height:auto;max-height:none;overflow:visible;cursor:move;';
                    
                    let savedPos = null;
                    try {{ savedPos = JSON.parse(localStorage.getItem('tc_dom_pos')); }} catch(e) {{}}
                    if (savedPos && savedPos.top && savedPos.left) {{
                        domEl.style.top = savedPos.top;
                        domEl.style.left = savedPos.left;
                    }}

                    // Drag support (exempt clicks on mode toggle pill / buttons)
                    let isDragging = false;
                    let startX, startY, origLeft, origTop;
                    domEl.addEventListener('mousedown', function(e) {{
                        if (e.target.closest('#tc-dom-mode-pill') || e.target.tagName === 'BUTTON') return;
                        if (e.button !== 0) return;
                        isDragging = true;
                        startX = e.clientX;
                        startY = e.clientY;
                        const rect = domEl.getBoundingClientRect();
                        origLeft = rect.left;
                        origTop = rect.top;
                        function onMouseMove(moveEvent) {{
                            if (!isDragging) return;
                            domEl.style.left = (origLeft + moveEvent.clientX - startX) + 'px';
                            domEl.style.top = (origTop + moveEvent.clientY - startY) + 'px';
                        }}
                        function onMouseUp() {{
                            if (!isDragging) return;
                            isDragging = false;
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                            try {{
                                localStorage.setItem('tc_dom_pos', JSON.stringify({{
                                    top: domEl.style.top,
                                    left: domEl.style.left
                                }}));
                            }} catch(e) {{}}
                        }}
                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                    }});

                    document.body.appendChild(domEl);
                }} else {{
                    domEl.style.width = '380px';
                    domEl.style.height = 'auto';
                    domEl.style.maxHeight = 'none';
                    domEl.style.overflow = 'visible';
                    domEl.style.overflowY = 'visible';
                }}

                // Vibrancy helper: lighter for smaller orders, saturated & vibrant for bigger levels
                function getPutStyle(pct) {{
                    if (!pct || pct <= 0) return {{ bg: 'transparent', text: '#64748b', barBorder: '', textWeight: '600', glow: '' }};
                    if (pct < 20) {{
                        return {{ bg: 'rgba(16,185,129,0.14)', text: '#a7f3d0', barBorder: '', textWeight: 'bold', glow: '' }};
                    }} else if (pct < 50) {{
                        return {{ bg: 'rgba(16,185,129,0.38)', text: '#34d399', barBorder: '', textWeight: 'bold', glow: '' }};
                    }} else if (pct < 80) {{
                        return {{ bg: 'rgba(16,185,129,0.65)', text: '#ffffff', barBorder: '', textWeight: '900', glow: '' }};
                    }} else {{
                        return {{ bg: 'rgba(16,185,129,0.90)', text: '#ffffff', barBorder: '', textWeight: '900', glow: '' }};
                    }}
                }}

                function getCallStyle(pct) {{
                    if (!pct || pct <= 0) return {{ bg: 'transparent', text: '#64748b', barBorder: '', textWeight: '600', glow: '' }};
                    if (pct < 20) {{
                        return {{ bg: 'rgba(239,68,68,0.14)', text: '#fecaca', barBorder: '', textWeight: 'bold', glow: '' }};
                    }} else if (pct < 50) {{
                        return {{ bg: 'rgba(239,68,68,0.38)', text: '#f87171', barBorder: '', textWeight: 'bold', glow: '' }};
                    }} else if (pct < 80) {{
                        return {{ bg: 'rgba(239,68,68,0.65)', text: '#ffffff', barBorder: '', textWeight: '900', glow: '' }};
                    }} else {{
                        return {{ bg: 'rgba(239,68,68,0.90)', text: '#ffffff', barBorder: '', textWeight: '900', glow: '' }};
                    }}
                }}

                window._setDomMode = function(newMode) {{
                    window._tc_dom_mode = newMode;
                    try {{ localStorage.setItem('tc_dom_mode', newMode); }} catch(e) {{}}
                    const cur = getActiveTvSymbol() || window._tc_last_known_symbol || currentSym;
                    if (window._renderOptionsDOM) window._renderOptionsDOM(cur);
                }};

                window._renderOptionsDOM = function(targetSym) {{
                    const el = document.getElementById('tc-options-dom');
                    if (!el) return;
                    el.style.width = '380px';
                    const sym = (targetSym || '').toUpperCase().trim();
                    if (!sym) return;

                    // Clean up any stray standalone hud
                    const strayHud = document.getElementById('tc-sinclair-hud');
                    if (strayHud) strayHud.remove();

                    // 1. Sinclair Metrics mounted directly on top of DOM (no "Sinclair", no asset tag, no CHOP/TREND box)
                    const sData = window._tc_sinclair_cache ? window._tc_sinclair_cache[sym] : null;
                    let vrpVal = '—', vrpColor = '#94a3b8';
                    let rangeVal = '±1σ', ivVal = '—', rvVal = '—';
                    if (sData) {{
                        let vrpSpread = parseFloat(sData.vrp_spread) || 0.0;
                        let vrpSign = vrpSpread >= 0 ? '+' : '';
                        vrpVal = `${{vrpSign}}${{vrpSpread.toFixed(1)}}`;
                        vrpColor = vrpSpread >= 0 ? '#10b981' : '#38bdf8';
                        ivVal = parseFloat(sData.implied_volatility) ? `${{parseFloat(sData.implied_volatility).toFixed(1)}}%` : '—';
                        rvVal = parseFloat(sData.rv_yang_zhang) ? `${{parseFloat(sData.rv_yang_zhang).toFixed(1)}}%` : '—';
                        rangeVal = sData.weekly_expected_move_dollars ? ('±$' + parseFloat(sData.weekly_expected_move_dollars).toFixed(2)) : '±1σ';
                    }}

                    // Scenario panel from TCEngine (window._tc_playbook is set by the injector's engine run)
                    const pb = window._tc_playbook ? window._tc_playbook[sym] : null;
                    let topMetricsHtml = '';
                    if (pb && pb.scenario) {{
                        const regColor = {{RANGE: '#10b981', MILD_POS: '#34d399', MILD_NEG: '#fb923c', EXPANSION: '#ef4444'}}[pb.scenario.code] || '#94a3b8';
                        const esc = (s) => String(s).replace(/[&<>]/g, c => ({{'&': '&amp;', '<': '&lt;', '>': '&gt;'}})[c]);
                        const lines = pb.scenario.lines.map(l => `<div style="color:#cbd5e1;font-size:10px;line-height:1.35;margin:1px 0;">· ${{esc(l)}}</div>`).join('');
                        const notes = (pb.notes || []).map(n => `<div style="color:#64748b;font-size:9px;margin-top:2px;">${{esc(n)}}</div>`).join('');
                        const gfTxt = pb.gammaFlip ? ('flip $' + pb.gammaFlip.toFixed(2)) : 'flip n/a';
                        topMetricsHtml = `
                            <div style="margin-bottom:6px;padding:5px 6px;border:1px solid ${{regColor}}55;border-left:3px solid ${{regColor}};border-radius:4px;background:rgba(15,23,42,0.6);cursor:move;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                                    <span style="font-weight:900;color:${{regColor}};font-size:11px;">${{esc(pb.scenario.title)}}</span>
                                    <span style="color:#94a3b8;font-size:9.5px;">${{gfTxt}}</span>
                                </div>
                                ${{lines}}${{notes}}
                            </div>`;
                    }}

                    // 2. Resolve active ladder based on selected mode (0DTE vs Weekly)
                    const rawDom = (window._tc_dom_cache && window._tc_dom_cache[sym]) ? window._tc_dom_cache[sym] : null;
                    const mode = window._tc_dom_mode || 'weekly';
                    let curLadder = null;
                    if (rawDom) {{
                        if (Array.isArray(rawDom)) {{
                            curLadder = rawDom;
                        }} else if (rawDom[mode] && Array.isArray(rawDom[mode])) {{
                            curLadder = rawDom[mode];
                        }} else if (rawDom.weekly && Array.isArray(rawDom.weekly)) {{
                            curLadder = rawDom.weekly;
                        }} else if (rawDom['0dte'] && Array.isArray(rawDom['0dte'])) {{
                            curLadder = rawDom['0dte'];
                        }}
                    }}

                    if (!curLadder || curLadder.length === 0) {{
                        el.innerHTML = `
                            ${{topMetricsHtml}}
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;border-top:1px solid #1e293b;border-bottom:1px solid #1e293b;padding:5px 0;cursor:move;" title="Drag to reposition">
                                <span style="font-weight:bold;color:#94a3b8;font-size:11px;">📊 DOM · NOT AVAILABLE</span>
                                <span style="font-weight:bold;color:#fff;background:#1e293b;padding:2px 6px;border-radius:3px;font-size:10px;">${{sym}}</span>
                            </div>
                            <div style="color:#64748b;font-size:10px;text-align:center;padding:12px 0;">
                                Real options chain not available for ${{sym}}.
                            </div>
                        `;
                        return;
                    }}

                    const isWeekly = (mode === 'weekly');
                    const fmtK = (n) => n ? (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)) : '';
                    const maxVol = Math.max(1, ...curLadder.map(r => Math.max(r.call_vol || 0, r.put_vol || 0)));
                    // Spot row follows the chart's last price; falls back to the strike picked at fetch time
                    const live = (getActiveTvSymbol() === sym) ? getLivePrice() : null;
                    const spotStrike = live ? closestStrike(curLadder.map(r => r.strike), live) : null;
                    window._tc_drawn_sym = sym;
                    window._tc_drawn_strikes = curLadder.map(r => r.strike);
                    window._tc_drawn_spot = spotStrike;
                    let rowsHtml = '';
                    for (let row of curLadder) {{
                        const isSpot = spotStrike !== null ? row.strike === spotStrike : row.is_spot;
                        const spotStyle = isSpot ? 'background:rgba(56,189,248,0.22);border:1px solid rgba(56,189,248,0.65);border-radius:3px;' : '';
                        const strikeColor = isSpot ? '#38bdf8;font-weight:900;' : '#e2e8f0;font-weight:bold;';
                        const putW = row.put_bar_pct || 0;
                        const callW = row.call_bar_pct || 0;
                        const put0dteW = (isWeekly && row.put_0dte_pct) ? row.put_0dte_pct : 0;
                        const call0dteW = (isWeekly && row.call_0dte_pct) ? row.call_0dte_pct : 0;

                        const putK = fmtK(row.put_oi);
                        const callK = fmtK(row.call_oi);
                        const putVolW = Math.round(100 * (row.put_vol || 0) / maxVol);
                        const callVolW = Math.round(100 * (row.call_vol || 0) / maxVol);
                        // Net = calls minus puts (OI + today's volume): red when calls own the strike, green when puts do
                        const net = (row.call_oi || 0) + (row.call_vol || 0) - (row.put_oi || 0) - (row.put_vol || 0);
                        const netTxt = net ? (net > 0 ? '+' : '-') + fmtK(Math.abs(net)) : '';
                        const netColor = net > 0 ? '#f87171' : '#34d399';
                        const volStyle = 'position:relative;color:#e2e8f0;font-size:9.5px;background:rgba(10,12,20,0.75);padding:0 2px;border-radius:2px;z-index:3;';
                        const volBar = 'position:absolute;bottom:0;height:3px;background:#e2e8f0;border-radius:1px;z-index:2;';

                        const pStyle = getPutStyle(putW);
                        const cStyle = getCallStyle(callW);

                        // Predominant 0DTE (> 50% of the bar's volume / OI): yellow text for puts, purple text for calls
                        const putIs0DtePredominant = isWeekly && ((row.put_0dte_oi && row.put_oi && (row.put_0dte_oi >= row.put_oi * 0.5)) || (put0dteW > 0 && put0dteW >= putW * 0.5));
                        const callIs0DtePredominant = isWeekly && ((row.call_0dte_oi && row.call_oi && (row.call_0dte_oi >= row.call_oi * 0.5)) || (call0dteW > 0 && call0dteW >= callW * 0.5));

                        const putTextColor = putIs0DtePredominant ? '#facc15' : pStyle.text;
                        const putTextWeight = putIs0DtePredominant ? '900' : (pStyle.textWeight || 'bold');
                        const putTextShadow = putIs0DtePredominant ? 'text-shadow: 0 1px 2px #000, 0 0 5px rgba(250,204,21,0.6);' : 'text-shadow: 0 1px 2px #000;';

                        const callTextColor = callIs0DtePredominant ? '#c084fc' : cStyle.text;
                        const callTextWeight = callIs0DtePredominant ? '900' : (cStyle.textWeight || 'bold');
                        const callTextShadow = callIs0DtePredominant ? 'text-shadow: 0 1px 2px #000, 0 0 5px rgba(192,132,252,0.6);' : 'text-shadow: 0 1px 2px #000;';

                        // Nested yellow/gold 0DTE bar inside green weekly Put bar
                        let putNestedHtml = '';
                        if (put0dteW > 0) {{
                            putNestedHtml = `<div style="position:absolute;right:0;top:1.5px;bottom:1.5px;width:${{put0dteW}}%;background:rgba(250,204,21,0.88);border-radius:2px;border-left:1.5px solid #fef08a;box-shadow:0 0 5px rgba(250,204,21,0.4);z-index:2;"></div>`;
                        }}

                        // Nested purple 0DTE bar inside red weekly Call bar
                        let callNestedHtml = '';
                        if (call0dteW > 0) {{
                            callNestedHtml = `<div style="position:absolute;left:0;top:1.5px;bottom:1.5px;width:${{call0dteW}}%;background:rgba(192,132,252,0.88);border-radius:2px;border-right:1.5px solid #e9d5ff;box-shadow:0 0 5px rgba(192,132,252,0.4);z-index:2;"></div>`;
                        }}

                        rowsHtml += `
                            <div style="display:grid;grid-template-columns:1fr 56px 1fr 48px;align-items:center;height:20px;margin:1px 0;font-size:11px;${{spotStyle}}">
                                <!-- PUT BID BAR (Text at outer left end of bar) -->
                                <div style="position:relative;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 4px 0 6px;">
                                    <div style="position:absolute;right:0;top:1.5px;bottom:1.5px;width:${{putW}}%;background:${{pStyle.bg}};border-radius:2px;${{pStyle.barBorder}}${{pStyle.glow}}z-index:1;"></div>
                                    ${{putNestedHtml}}
                                    <span style="position:relative;color:${{putTextColor}};font-weight:${{putTextWeight}};font-size:11px;font-family:Consolas,monospace;${{putTextShadow}}z-index:3;">${{putK}}</span>
                                    <span style="${{volStyle}}">${{fmtK(row.put_vol)}}</span>
                                    <div style="${{volBar}}right:0;width:${{putVolW}}%;"></div>
                                </div>
                                <!-- STRIKE -->
                                <div style="text-align:center;color:${{strikeColor}}font-family:Consolas,monospace;font-size:12px;text-shadow:0 1px 2px #000;">
                                    $${{parseFloat(row.strike).toFixed(1)}}
                                </div>
                                <!-- CALL ASK BAR (Text at outer right end of bar) -->
                                <div style="position:relative;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 6px 0 4px;">
                                    <div style="position:absolute;left:0;top:1.5px;bottom:1.5px;width:${{callW}}%;background:${{cStyle.bg}};border-radius:2px;${{cStyle.barBorder}}${{cStyle.glow}}z-index:1;"></div>
                                    ${{callNestedHtml}}
                                    <div style="${{volBar}}left:0;width:${{callVolW}}%;"></div>
                                    <span style="${{volStyle}}">${{fmtK(row.call_vol)}}</span>
                                    <span style="position:relative;color:${{callTextColor}};font-weight:${{callTextWeight}};font-size:11px;font-family:Consolas,monospace;${{callTextShadow}}z-index:3;">${{callK}}</span>
                                </div>
                                <div style="text-align:right;color:${{netColor}};font-size:10px;font-weight:bold;">${{netTxt}}</div>
                            </div>
                        `;
                    }}

                    const is0DteActive = (mode === '0dte');
                    const stamp = (rawDom && rawDom.fetched_at) ? new Date(rawDom.fetched_at * 1000).toLocaleTimeString([], {{hour: '2-digit', minute: '2-digit', hour12: false}}) : '';

                    el.innerHTML = `
                        ${{topMetricsHtml}}
                        <!-- TITLE ROW WITH 0DTE / WEEKLY TOGGLE (NO LIVE TEXT) -->
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;border-top:1px solid #1e293b;border-bottom:1px solid #1e293b;padding:5px 0;cursor:move;" title="Drag to reposition">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-weight:900;color:#14b8a6;font-size:12px;letter-spacing:0.5px;">📊 DOM</span>
                                <!-- 0DTE vs Weekly Pill -->
                                <div id="tc-dom-mode-pill" style="display:inline-flex;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:2px;font-size:9.5px;font-weight:bold;">
                                    <button id="tc-btn-0dte" type="button" style="border:none;outline:none;padding:2px 8px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:inherit;font-weight:inherit;transition:all 0.15s;${{is0DteActive ? 'background:#0d9488;color:#fff;box-shadow:0 0 6px rgba(13,148,136,0.6);' : 'background:transparent;color:#64748b;'}}">${{(rawDom && !Array.isArray(rawDom) && rawDom.nearest_dte > 0) ? (rawDom.nearest_dte + 'DTE') : '0DTE'}}</button>
                                    <button id="tc-btn-weekly" type="button" style="border:none;outline:none;padding:2px 8px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:inherit;font-weight:inherit;transition:all 0.15s;${{!is0DteActive ? 'background:#0d9488;color:#fff;box-shadow:0 0 6px rgba(13,148,136,0.6);' : 'background:transparent;color:#64748b;'}}">Weekly</button>
                                </div>
                            </div>
                            <span style="color:#94a3b8;font-size:10px;margin-left:auto;margin-right:8px;" title="Fetch time. Yahoo data, about 15 min delayed">${{stamp}}</span>
                            <span style="font-weight:bold;color:#fff;background:#1e293b;padding:2px 6px;border-radius:3px;font-size:10px;border:1px solid #334155;">${{sym}}</span>
                        </div>
                        <!-- COLUMN HEADERS -->
                        <div style="display:grid;grid-template-columns:1fr 56px 1fr 48px;font-size:10px;color:#94a3b8;margin-bottom:3px;font-weight:bold;">
                            <span style="display:flex;justify-content:space-between;padding:0 4px 0 6px;"><span style="color:#10b981;">PUT OI</span><span>VOL</span></span>
                            <span style="color:#cbd5e1;text-align:center;">STRIKE</span>
                            <span style="display:flex;justify-content:space-between;padding:0 6px 0 4px;"><span>VOL</span><span style="color:#ef4444;">CALL OI</span></span>
                            <span style="text-align:right;">NET</span>
                        </div>
                        <div style="display:flex;flex-direction:column;">
                            ${{rowsHtml}}
                        </div>
                    `;

                    // Direct event listeners for reliable switching (bypasses CSP & drag interference)
                    const btn0dte = el.querySelector('#tc-btn-0dte');
                    const btnWeekly = el.querySelector('#tc-btn-weekly');
                    if (btn0dte) {{
                        btn0dte.onmousedown = (e) => e.stopPropagation();
                        btn0dte.onpointerdown = (e) => e.stopPropagation();
                        btn0dte.onclick = (e) => {{
                            e.stopPropagation();
                            e.preventDefault();
                            window._setDomMode('0dte');
                        }};
                    }}
                    if (btnWeekly) {{
                        btnWeekly.onmousedown = (e) => e.stopPropagation();
                        btnWeekly.onpointerdown = (e) => e.stopPropagation();
                        btnWeekly.onclick = (e) => {{
                            e.stopPropagation();
                            e.preventDefault();
                            window._setDomMode('weekly');
                        }};
                    }}
                }};

                function getActiveTvSymbol() {{
                    try {{
                        const c = window._exposed_chartWidgetCollection || window.chartWidgetCollection;
                        if (c && c.activeChartWidget && c.activeChartWidget.value()) {{
                            const w = c.activeChartWidget.value();
                            const m = w.model();
                            const im = m && m.model ? m.model() : m;
                            if (im && im.mainSeries) {{
                                const s = im.mainSeries();
                                let sname = null;
                                if (typeof s.symbol === 'function') sname = s.symbol();
                                else if (s._symbol) sname = s._symbol;
                                if (!sname && typeof s.symbolInfo === 'function' && s.symbolInfo()) {{
                                    sname = s.symbolInfo().name;
                                }}
                                if (sname) {{
                                    const clean = sname.split(':').pop().replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
                                    if (clean) return clean;
                                }}
                            }}
                        }}
                    }} catch(e) {{}}
                    try {{
                        const btn = document.querySelector('#header-toolbar-symbol-search .js-button-text, [data-name="legend-series-item"] [data-name="legend-source-title"]');
                        if (btn && btn.textContent) {{
                            const txt = btn.textContent.trim().split(' ')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                            if (txt) return txt;
                        }}
                    }} catch(e) {{}}
                    return null;
                }}

                function getLivePrice() {{
                    try {{
                        const c = window._exposed_chartWidgetCollection || window.chartWidgetCollection;
                        const m = c.activeChartWidget.value().model();
                        const im = m && m.model ? m.model() : m;
                        const last = im.mainSeries().data().bars().last();
                        return (last && last.value) ? last.value[4] : null;
                    }} catch(e) {{ return null; }}
                }}

                function closestStrike(strikes, price) {{
                    return strikes.reduce((a, b) => Math.abs(b - price) < Math.abs(a - price) ? b : a);
                }}

                // Re-render when the chart price crosses into another strike
                if (!window._tc_spot_watcher_active) {{
                    window._tc_spot_watcher_active = true;
                    setInterval(() => {{
                        try {{
                            const price = getLivePrice();
                            const ks = window._tc_drawn_strikes;
                            if (price && ks && ks.length && getActiveTvSymbol() === window._tc_drawn_sym
                                && closestStrike(ks, price) !== window._tc_drawn_spot && window._renderOptionsDOM) {{
                                window._renderOptionsDOM(window._tc_drawn_sym);
                            }}
                        }} catch(e) {{}}
                    }}, 1000);
                }}

                if (!window._tc_symbol_watcher_active) {{
                    window._tc_symbol_watcher_active = true;
                    window._tc_last_known_symbol = null;
                    setInterval(() => {{
                        try {{
                            const curSym = getActiveTvSymbol();
                            if (curSym && curSym !== window._tc_last_known_symbol) {{
                                window._tc_last_known_symbol = curSym;
                                if (window._renderOptionsDOM) window._renderOptionsDOM(curSym);
                            }}
                        }} catch(e) {{}}
                    }}, 200);
                }}

                const curAct = getActiveTvSymbol() || currentSym;
                window._renderOptionsDOM(curAct);
                return "MOUNTED_DOM";
            }} catch(e) {{
                return "DOM_ERR: " + e.message;
            }}
        }})()
        """
        try:
            return self.execute_cdp_command(ws_url, js)
        except Exception as e:
            return f"CDP_ERR: {e}"

    def ensure_sinclair_hud_mounted(self, ws_url, force_render=False):
        if not ws_url:
            return False
        # Sinclair metrics are now unified directly on top of the DOM
        active_sym = self.fetch_current_ticker_from_chart(ws_url) or self.current_ticker or "SPY"
        dom_data = self.dom_cache.get(active_sym)
        # Refresh after 5 minutes, tracker running or not, and push the fresh chain to the chart
        # (a non-forced mount returns early and would leave the old ladder on screen).
        stale = time.time() - self.dom_cache_time.get(active_sym, 0) > 300
        refetched = not dom_data or stale
        if refetched:
            force_render = True
            dom_data = self.fetch_real_weekly_dom(active_sym, max_strikes=34)
            self.dom_cache[active_sym] = dom_data
            self.dom_cache_time[active_sym] = time.time()
        res = self.ensure_options_dom_mounted(ws_url, active_sym, dom_data, force_render=force_render)
        if refetched:
            self.refresh_wall_lines(ws_url, active_sym, dom_data)  # keep the wall lines on the same chain as the DOM
        return res

    def fetch_current_ticker_from_chart(self, ws_url):
        js = """
        (function() {
            try {
                function getCwc() {
                    if (window._exposed_chartWidgetCollection) return window._exposed_chartWidgetCollection;
                    if (window.chartWidgetCollection) return window.chartWidgetCollection;
                    for (let i = 0; i < window.frames.length; i++) {
                        try {
                            if (window.frames[i]._exposed_chartWidgetCollection) return window.frames[i]._exposed_chartWidgetCollection;
                            if (window.frames[i].chartWidgetCollection) return window.frames[i].chartWidgetCollection;
                        } catch(e) {}
                    }
                    return null;
                }
                const cwc = getCwc();
                if (!cwc) return null;
                const widget = cwc.activeChartWidget.value();
                if (!widget) return null;
                const model = widget.model();
                if (!model) return null;
                return model.mainSeries().symbol();
            } catch(e) {
                return null;
            }
        })()
        """
        raw_symbol = self.execute_cdp_command(ws_url, js)
        if not raw_symbol or not isinstance(raw_symbol, str) or raw_symbol.startswith("CDP_ERR"):
            return None
        return self.clean_symbol(raw_symbol)

    def switch_tv_chart_symbol(self, ws_url, ticker):
        js = f"""
        (function() {{
            try {{
                const cwc = window._exposed_chartWidgetCollection || window.chartWidgetCollection;
                if (!cwc) return false;
                const widget = cwc.activeChartWidget.value();
                if (widget && typeof widget.setSymbol === 'function') {{
                    widget.setSymbol("{ticker}");
                    return true;
                }}
                if (widget && widget.model() && widget.model().mainSeries() && typeof widget.model().mainSeries().setSymbol === 'function') {{
                    widget.model().mainSeries().setSymbol("{ticker}");
                    return true;
                }}
                return false;
            }} catch(e) {{
                return false;
            }}
        }})()
        """
        return self.execute_cdp_command(ws_url, js)

    def fetch_real_weekly_dom(self, ticker, spot=None, max_strikes=34):
        """
        Fetches 100% REAL live market options chain from Yahoo Finance.
        Returns a dict: {"0dte": [...], "weekly": [...]}
        Extracts up to max_strikes contracts tightly centered around spot.
        """
        try:
            import yfinance as yf
            import datetime
            import pandas as pd

            tk_symbol = self.yahoo_symbol(ticker)

            tk = yf.Ticker(tk_symbol)
            if not spot or spot <= 0:
                hist = tk.history(period="5d")
                if hist.empty:
                    # No real spot price: don't centre the ladder on a made-up price.
                    return {"0dte": [], "weekly": []}
                spot = float(hist["Close"].iloc[-1])

            exps = tk.options
            if not exps:
                return {"0dte": [], "weekly": []}

            today = datetime.date.today()
            by_strike_0dte = {}
            by_strike_weekly = {}

            # Pre-fetch needed expirations in parallel (avoids sequential wait & duplicate exp_0 fetch)
            exp_0 = exps[0]
            weekly_exps = []
            for exp in exps[:6]:
                try:
                    d = datetime.datetime.strptime(exp, "%Y-%m-%d").date()
                    dte = (d - today).days
                    if 0 <= dte <= 7:
                        weekly_exps.append(exp)
                except Exception:
                    continue

            unique_exps = list(dict.fromkeys([exp_0] + weekly_exps))
            fetched_chains = {}
            with ThreadPoolExecutor(max_workers=min(6, len(unique_exps) or 1)) as pool:
                futs = {e: pool.submit(tk.option_chain, e) for e in unique_exps}
                for e, fut in futs.items():
                    try:
                        fetched_chains[e] = fut.result(timeout=8)
                    except Exception as ex:
                        if e == exp_0:
                            self.log(f"0DTE chain fetch note for {ticker}: {ex}")

            # Expiration 0 (nearest, 0DTE / next session)
            def num(r, col):
                v = r[col] if col in r else None
                return 0.0 if v is None or pd.isna(v) else float(v)

            if exp_0 in fetched_chains:
                chain_0 = fetched_chains[exp_0]
                # Quotes and IV are kept for the nearest expiry so the daily snapshots can later price option trades
                for side, frame in (("call", chain_0.calls), ("put", chain_0.puts)):
                    for _, r in frame.iterrows():
                        k = float(r["strike"])
                        row = by_strike_0dte.setdefault(k, {"strike": k, "call_oi": 0, "put_oi": 0, "call_vol": 0, "put_vol": 0})
                        row[f"{side}_oi"] += int(num(r, "openInterest"))
                        row[f"{side}_vol"] += int(num(r, "volume"))
                        row[f"{side}_bid"] = num(r, "bid")
                        row[f"{side}_ask"] = num(r, "ask")
                        row[f"{side}_iv"] = round(num(r, "impliedVolatility"), 4)

            # Gather nearest weekly expirations (<= 7 DTE)
            for exp in weekly_exps:
                chain = fetched_chains.get(exp)
                if not chain:
                    continue
                try:
                    for _, r in chain.calls.iterrows():
                        k = float(r["strike"])
                        oi = int(r["openInterest"]) if ("openInterest" in r and not pd.isna(r["openInterest"])) else 0
                        vol = int(r["volume"]) if ("volume" in r and not pd.isna(r["volume"])) else 0
                        by_strike_weekly.setdefault(k, {"strike": k, "call_oi": 0, "put_oi": 0, "call_vol": 0, "put_vol": 0})
                        by_strike_weekly[k]["call_oi"] += oi
                        by_strike_weekly[k]["call_vol"] += vol
                    for _, r in chain.puts.iterrows():
                        k = float(r["strike"])
                        oi = int(r["openInterest"]) if ("openInterest" in r and not pd.isna(r["openInterest"])) else 0
                        vol = int(r["volume"]) if ("volume" in r and not pd.isna(r["volume"])) else 0
                        by_strike_weekly.setdefault(k, {"strike": k, "call_oi": 0, "put_oi": 0, "call_vol": 0, "put_vol": 0})
                        by_strike_weekly[k]["put_oi"] += oi
                        by_strike_weekly[k]["put_vol"] += vol
                except Exception:
                    continue

            def build_ladder(by_strike_dict, is_weekly=False):
                if not by_strike_dict:
                    return []
                all_strikes = list(by_strike_dict.values())
                all_strikes.sort(key=lambda x: abs(x["strike"] - spot))
                selected = all_strikes[:max_strikes]
                selected.sort(key=lambda x: x["strike"], reverse=True)

                # One shared scale for puts and calls, so bar lengths are comparable across the
                # strike (separate scales made a 1k put wall look as big as a 10k call wall).
                shared_max = max([max(s["call_oi"], s["put_oi"]) for s in selected], default=1) or 1
                max_c = max_p = shared_max
                closest_strike = min(selected, key=lambda x: abs(x["strike"] - spot))["strike"]

                ladder = []
                for s in selected:
                    k = s["strike"]
                    c_pct = min(100, int((s["call_oi"] / max_c) * 100))
                    p_pct = min(100, int((s["put_oi"] / max_p) * 100))
                    
                    p_0_pct = 0
                    c_0_pct = 0
                    p0 = 0
                    c0 = 0
                    if is_weekly:
                        s0 = by_strike_0dte.get(k, {})
                        p0 = s0.get("put_oi", 0)
                        c0 = s0.get("call_oi", 0)
                        p_0_pct = min(p_pct, int((p0 / max_p) * 100)) if max_p > 0 else 0
                        c_0_pct = min(c_pct, int((c0 / max_c) * 100)) if max_c > 0 else 0

                    ladder.append({
                        "strike": k,
                        "call_oi": s["call_oi"],
                        "put_oi": s["put_oi"],
                        "call_vol": s["call_vol"],
                        "put_vol": s["put_vol"],
                        "call_bar_pct": c_pct,
                        "put_bar_pct": p_pct,
                        "put_0dte_pct": p_0_pct,
                        "call_0dte_pct": c_0_pct,
                        "put_0dte_oi": p0,
                        "call_0dte_oi": c0,
                        "is_spot": k == closest_strike,
                        "is_real": True,
                        **{f: s[f] for f in ("call_bid", "call_ask", "call_iv", "put_bid", "put_ask", "put_iv") if f in s},
                    })
                return ladder

            ladder_0dte = build_ladder(by_strike_0dte, is_weekly=False)
            ladder_weekly = build_ladder(by_strike_weekly, is_weekly=True)

            # The "0DTE" ladder is the nearest expiration, which is not always today
            # (weekends, names with only Friday expiries). Record its real days to expiry.
            try:
                nearest_dte = (datetime.datetime.strptime(exp_0, "%Y-%m-%d").date() - today).days
            except Exception:
                nearest_dte = 0

            return {
                "0dte": ladder_0dte,
                "weekly": ladder_weekly,
                "nearest_dte": nearest_dte,
                "nearest_exp": exp_0,
                "fetched_at": time.time(),
            }
        except Exception as e:
            self.log(f"Real options DOM fetch exception for {ticker}: {e}")
            return {"0dte": [], "weekly": []}
    VOL_INDEX = {"SPY": "^VIX", "QQQ": "^VXN"}  # the engine's odds were calibrated with these as IV

    def fetch_engine_inputs(self, ticker, dom=None):
        """Real inputs for TCEngine.analyze, from Yahoo: today's RTH 5m bars, prior sessions (ATR, prior day),
        the vol index's prior close as IV, and premarket high/low (drawn as plain lines, no odds)."""
        try:
            import yfinance as yf
            tk = yf.Ticker(self.yahoo_symbol(ticker))
            m5 = tk.history(period="5d", interval="5m", prepost=True)
            if m5.empty or str(m5.index.tz) != "America/New_York":
                return None
            day, t = m5.index.date, m5.index.time
            today = day[-1]
            open_t, close_t = datetime.time(9, 30), datetime.time(16, 0)
            rth = m5[(day == today) & (t >= open_t) & (t < close_t)]
            pm = m5[(day == today) & (t < open_t)]
            d1 = tk.history(period="3mo", interval="1d", auto_adjust=False)
            d1 = d1[d1.index.date < today]  # prior sessions only; today's partial bar would skew ATR
            if len(d1) < 16:
                return None
            daily = d1[["Open", "High", "Low", "Close"]].round(4).values.tolist()
            iv = None
            if ticker in self.VOL_INDEX:
                v = yf.Ticker(self.VOL_INDEX[ticker]).history(period="1mo", interval="1d")
                v = v[v.index.date < today]
                if not v.empty:
                    iv = float(v["Close"].iloc[-1]) / 100
            if iv is None and isinstance(dom, dict):
                # Uncalibrated ticker: median IV of the nearest-expiry strikes around spot
                ivs = sorted(x for r in dom.get("0dte", [])[10:24] for x in (r.get("call_iv"), r.get("put_iv")) if x and 0.03 < x < 3)
                iv = ivs[len(ivs) // 2] if ivs else None
            bars = [[int(ts.timestamp()), *map(float, row)] for ts, row in zip(rth.index, rth[["Open", "High", "Low", "Close"]].values)]
            last = float(m5["Close"].iloc[-1])
            extra = []
            if not pm.empty:
                extra = [{"price": round(float(pm["High"].max()), 2), "label": "PREMARKET HIGH", "color": "#38bdf8"},
                         {"price": round(float(pm["Low"].min()), 2), "label": "PREMARKET LOW", "color": "#38bdf8"}]
            return {
                # Before 09:30 there is no open yet: the last premarket price stands in for it
                "ticker": ticker, "open": bars[0][1] if bars else last, "spot": last, "preOpen": not bars,
                "daily": daily[-30:], "prevDay": {"h": daily[-1][1], "l": daily[-1][2], "c": daily[-1][3]},
                "iv": iv, "bars": bars, "extra": extra, "_date": str(today),
            }
        except Exception as e:
            self.log(f"Engine inputs note for {ticker}: {e}")
            return None

    ENGINE_RUN_JS = """
    (function() {
        try {
            if (!window.TCEngine || window.TCEngine.VERSION !== __VERSION__) {
                // module is shadowed so the engine registers itself as window.TCEngine
                (function(module) {
__ENGINE__
                }).call(window, undefined);
            }
            const sym = __SYM__;
            const out = window.TCEngine.analyze(__PAYLOAD__);
            window._tc_playbook = window._tc_playbook || {};
            window._tc_playbook[sym] = out;
            if (window._renderOptionsDOM && (window._tc_drawn_sym === sym || window._tc_last_known_symbol === sym)) window._renderOptionsDOM(sym);
            return JSON.stringify(out);
        } catch (e) {
            return "ENGINE_ERR: " + e.message;
        }
    })()
    """

    def run_engine(self, ws_url, ticker, inputs, dom):
        """TCEngine.analyze inside the chart page (engine injected once per page load). Returns the analysis dict."""
        payload = {k: v for k, v in inputs.items() if not k.startswith("_")}
        payload["weekly"] = [{"strike": r["strike"], "put_oi": r["put_oi"], "call_oi": r["call_oi"]} for r in dom.get("weekly", [])]
        payload["zdte"] = [{"strike": r["strike"], "put_oi": r["put_oi"], "call_oi": r["call_oi"],
                            "put_vol": r.get("put_vol", 0), "call_vol": r.get("call_vol", 0)} for r in dom.get("0dte", [])]
        js = (self.ENGINE_RUN_JS.replace("__VERSION__", json.dumps(self.engine_version))
              .replace("__SYM__", json.dumps(ticker)).replace("__PAYLOAD__", json.dumps(payload))
              .replace("__ENGINE__", self.engine_js))  # engine last: its source is never searched for placeholders
        res = self.execute_cdp_command(ws_url, js, timeout=15)
        if not isinstance(res, str) or not res.startswith("{"):
            self.log(f"Engine note for {ticker}: {res}")
            return None
        return json.loads(res)

    def build_engine_levels(self, ws_url, ticker, dom):
        """Lines to draw + scenario from TCEngine: weekly walls with calibrated odds, 0DTE walls (OI + volume),
        gamma flip from the chain, prior day, completed 10m/30m opening ranges, premarket high/low."""
        if not isinstance(dom, dict) or not (dom.get("weekly") or dom.get("0dte")):
            return [], None
        inputs = self.fetch_engine_inputs(ticker, dom)
        if not inputs:
            return [], None
        analysis = self.run_engine(ws_url, ticker, inputs, dom)
        if not analysis or analysis.get("error"):
            return [], analysis
        self.write_snapshot(ticker, dom, inputs, analysis)
        return [{"price": round(l["price"], 2), "label": l["label"], "color": l["color"]} for l in analysis["levels"]], analysis

    def write_snapshot(self, ticker, dom, inputs, analysis):
        """Archive the chain (OI, volume, bid/ask, IV), today's bars and the analysis, at most every 30 min per ticker.
        Over time this builds a real intraday + options dataset, which the backtester's history lacks."""
        now = time.time()
        if now - self.snapshot_time.get(ticker, 0) < 1800:
            return
        try:
            folder = os.path.join(self.snapshot_dir, inputs["_date"])
            os.makedirs(folder, exist_ok=True)
            with open(os.path.join(folder, f"{ticker}_{time.strftime('%H%M')}.json"), "w", encoding="utf-8") as f:
                json.dump({"ticker": ticker, "saved_at": now, "inputs": inputs, "dom": dom, "analysis": analysis}, f)
            self.snapshot_time[ticker] = now
        except Exception as e:
            self.log(f"Snapshot note for {ticker}: {e}")

    def synthesize_weekly_dom_fallback(self, spot, data, ticker=""):
        # BANNED: Synthetic/simulated DOM generation is strictly disabled.
        # If real market options are not available, return empty list.
        return []

    # Labels both injectors have ever drawn (they share one TradingView chart). Fallback for lines
    # drawn before ids were recorded; anything drawn now is matched by id.
    SCRIPT_LINE_RE = (r"CALL WALL|PUT WALL|GAMMA FLIP|Gamma Flip|MAX PAIN|Max Pain|WEEKLY PIN|Weekly Pin|"
                      r"OPEX ANCHOR|Opex Anchor|EXP MOVE|Expected Move|CONFLUENCE|TECH|PIVOT|Pivot Price|"
                      r"Technical|Absorption|Target Level|DTE|SMA|CALL RES|PUT SUP|"
                      r"(Major|Int|Minor) (Res|Sup)|PRIOR DAY|PREMARKET|OPENING RANGE|"
                      r"\b(PDH|PDL|PDC|PMH|PML|ORH|ORL)\b")

    def clear_script_lines(self, ws_url):
        """Removes the horizontal lines this injector drew; leaves the user's own drawings alone."""
        js = """
        (async function() {
            try {
                const cwc = window._exposed_chartWidgetCollection || window.chartWidgetCollection;
                const widget = cwc && cwc.activeChartWidget.value();
                if (!widget) return "NO_CHART";
                const model = widget.model();
                let ids = [];
                try { ids = JSON.parse(localStorage.getItem('tc_script_line_ids') || '[]'); } catch(e) {}
                const re = new RegExp(__RE__);
                const toRemove = model.model().allLineTools().filter(s => {
                    let id = null, txt = '';
                    try { id = s.id(); } catch(e) {}
                    try { txt = s.properties().text.value(); } catch(e) {}
                    const horz = /Horizontal|HorzLine/.test(s.name ? s.name() : '');
                    return (id !== null && ids.includes(id)) || (horz && re.test(txt));
                });
                if (toRemove.length) model.removeSources(toRemove);
                const sync = widget._lineToolsSynchronizer;
                if (sync && sync.flushPendingSavings) await sync.flushPendingSavings();
                return "CLEARED_" + toRemove.length;
            } catch(e) {
                return "CLEAR_ERR: " + e.message;
            }
        })()
        """.replace("__RE__", json.dumps(self.SCRIPT_LINE_RE))
        return self.execute_cdp_command(ws_url, js, timeout=10)

    def draw_levels_for_ticker(self, ws_url, ticker):
        self.log(f"Clearing previous levels: {self.clear_script_lines(ws_url)}")
        self.log(f"Fetching option & technical levels for {ticker} from TrueCharts...")
        data = None
        
        # Map CFD / index display tickers to backend analysis tickers
        api_ticker = self.yahoo_symbol(ticker)

        # Start DOM fetch in parallel while API request runs so both finish simultaneously
        dom_pool = ThreadPoolExecutor(max_workers=1)
        dom_future = dom_pool.submit(self.fetch_real_weekly_dom, ticker, None, 34)

        # Fast 30ms check for local backend on 127.0.0.1:8000 (eliminates 4s Windows localhost timeout)
        local_api = "http://127.0.0.1:8000/api/analyze"
        endpoints_to_try = [self.api_url]
        try:
            with socket.create_connection(("127.0.0.1", 8000), timeout=0.03):
                endpoints_to_try = [local_api, self.api_url]
        except Exception:
            pass

        for endpoint in endpoints_to_try:
            try:
                to = 2 if endpoint == local_api else 15
                url = f"{endpoint}/{urllib.parse.quote(api_ticker)}"
                resp = self._http_session.get(url, timeout=to)
                if resp.status_code == 404:
                    self.log(f"Ticker {ticker} ({api_ticker}) not found (HTTP 404).")
                    break
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        break
            except Exception as e:
                if endpoint != local_api:
                    self.log(f"Note: {endpoint} ({e})")
                continue

        if not data:
            # Previously this invented levels (gamma flip = spot x 0.9965, ±1.8% move, walls at
            # spot -9/+8) and fixed Sinclair numbers, and drew them as if real. Now: no backend
            # data -> no levels drawn; the real options DOM from Yahoo is still shown.
            self.log(f"TrueCharts backend unavailable for {ticker}: no Sinclair stats (levels and gamma flip come from the local engine).")
            data = {}


        # Real spot only; fetch_real_weekly_dom looks up the price itself when this is None.
        spot_val = float(data.get("spot") or data.get("current_price") or 0) or None
        sinclair_vol = data.get("sinclair_volatility") or {}
        weekly_dom = []  # always the live Yahoo chain: walls are computed from it
        
        # Priority: Fetch 100% REAL LIVE market options chain (0DTE & Weekly) via yfinance (already running in parallel)
        if not weekly_dom or isinstance(weekly_dom, list):
            self.log(f"Fetching real market options DOM (0DTE & Weekly) for {ticker}...")
            try:
                weekly_dom = dom_future.result(timeout=12)
            except Exception:
                weekly_dom = self.fetch_real_weekly_dom(ticker, spot_val, max_strikes=34)
            finally:
                dom_pool.shutdown(wait=False)
            if weekly_dom and (weekly_dom.get("0dte") or weekly_dom.get("weekly")):
                self.log(f"Loaded 100% REAL market options DOM for {ticker} (0DTE & Weekly).")
            else:
                self.log(f"No real market options chain available for {ticker}.")
                weekly_dom = {"0dte": [], "weekly": []}

        self.dom_cache[ticker] = weekly_dom
        self.dom_cache_time[ticker] = time.time()
        levels_to_draw, analysis = self.build_engine_levels(ws_url, ticker, weekly_dom)
        if analysis and analysis.get("scenario"):
            gf = analysis.get("gammaFlip")
            self.log(f"─── SCENARIO ({ticker}): {analysis['scenario']['title']} | gamma flip {gf:.2f} ───" if gf else f"─── SCENARIO ({ticker}): {analysis['scenario']['title']} ───")
            for line in analysis["scenario"]["lines"]:
                self.log(f"  {line}")
        for lvl in levels_to_draw:
            self.log(f"  {lvl['price']:.2f}  {lvl['label']}")
        if sinclair_vol:
            self.sinclair_cache[ticker] = sinclair_vol
            self.log(f"─── SINCLAIR VOLATILITY REGIME ({ticker}) ───")
            self.log(f"  Regime: {sinclair_vol.get('regime_verdict')}")
            vrp = sinclair_vol.get('vrp_spread')
            vrp_txt = f"{float(vrp):+0.1f}" if isinstance(vrp, (int, float)) else "n/a"  # a missing VRP used to crash the whole draw
            self.log(f"  IV: {sinclair_vol.get('implied_volatility')}% vs YZ-RV: {sinclair_vol.get('rv_yang_zhang')}% (VRP: {vrp_txt} pts)")
            if sinclair_vol.get('weekly_expected_move_dollars'):
                self.log(f"  Weekly Move: ±${sinclair_vol.get('weekly_expected_move_dollars')} (±{sinclair_vol.get('weekly_expected_move_pct')}%)")
            self.log(f"  Term: {sinclair_vol.get('term_structure_regime', '').split('(')[0].strip()} ({sinclair_vol.get('ivts')}x) | Skew: {sinclair_vol.get('skew_bias')}")
            self.log(f"────────────────────────────────────────────")

        self.gamma_cache[ticker] = float(data.get("gamma_flip") or 0)
        result = self.draw_level_lines(ws_url, ticker, levels_to_draw)
        if isinstance(result, str) and result.startswith("STALE_SKIPPED"):
            return  # chart moved on to another symbol; its own draw will follow

        # Auto-mount or refresh Options DOM if weekly_dom exists
        if weekly_dom:
            self.ensure_options_dom_mounted(ws_url, ticker, weekly_dom, force_render=True)
            n0 = len(weekly_dom.get("0dte", [])) if isinstance(weekly_dom, dict) else len(weekly_dom)
            nw = len(weekly_dom.get("weekly", [])) if isinstance(weekly_dom, dict) else len(weekly_dom)
            self.log(f"Options DOM updated for {ticker} (nearest expiry: {n0} strikes, weekly: {nw} strikes).")

    def draw_level_lines(self, ws_url, ticker, levels_to_draw):
        """Replaces this script's level lines on the active chart with levels_to_draw."""
        self.log(f"Injecting {len(levels_to_draw)} exact site levels for {ticker} into TradingView...")
        
        js_draw = f"""
        (async function() {{
            try {{
                let toolMod = null;
                if (window.webpackChunktradingview) {{
                    try {{
                        window.webpackChunktradingview.push([[999995], {{}}, function(req) {{
                            if (req && req.m) {{
                                if (req.m[512582]) {{
                                    try {{ toolMod = req(512582); }} catch(e) {{}}
                                }}
                                if (!toolMod || !toolMod.ensureLineToolLoaded) {{
                                    for (let id in req.m) {{
                                        try {{
                                            let exp = req(id);
                                            if (exp && typeof exp.ensureLineToolLoaded === 'function') {{
                                                toolMod = exp;
                                                break;
                                            }}
                                        }} catch(e) {{}}
                                    }}
                                }}
                            }}
                        }}]);
                    }} catch(e) {{}}
                }}
                if (toolMod && typeof toolMod.ensureLineToolLoaded === 'function') {{
                    try {{
                        await toolMod.ensureLineToolLoaded('LineToolHorzLine');
                    }} catch(e) {{}}
                }}
                
                function getCwc() {{
                    if (window._exposed_chartWidgetCollection) return window._exposed_chartWidgetCollection;
                    if (window.chartWidgetCollection) return window.chartWidgetCollection;
                    for (let i = 0; i < window.frames.length; i++) {{
                        try {{
                            if (window.frames[i]._exposed_chartWidgetCollection) return window.frames[i]._exposed_chartWidgetCollection;
                            if (window.frames[i].chartWidgetCollection) return window.frames[i].chartWidgetCollection;
                        }} catch(e) {{}}
                    }}
                    return null;
                }}
                
                const cwc = getCwc();
                if (!cwc) return "NO_CWC";
                const widget = cwc.activeChartWidget.value();
                const model = widget.model();
                const innerModel = model.model();
                const pane = model.panes()[0];
                const mainSeries = innerModel.mainSeries();

                // If the user already switched symbol while this ticker's data was loading, don't
                // draw its levels onto the new chart.
                try {{
                    const activeNow = String(mainSeries.symbol() || '').split(':').pop().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    if (activeNow && activeNow !== "{ticker}".toUpperCase()) return "STALE_SKIPPED_" + activeNow;
                }} catch(e) {{}}

                // Fetch actual live chart price and bar index for accurate scaling & X-axis projection
                let livePrice = null;
                let barIndex = 0;
                try {{
                    let bars = mainSeries.data().bars();
                    if (bars && bars.last) {{
                        let lastBar = bars.last();
                        if (lastBar) {{
                            if (lastBar.value) livePrice = lastBar.value[4];
                            if (lastBar.index !== undefined) barIndex = lastBar.index;
                        }}
                    }}
                }} catch(e) {{}}
                
                
                // 1. Remove this script's earlier lines right before drawing. The symbol's saved drawings
                // load a moment after a symbol switch, so the clear at the start of the run can miss them;
                // sweep again shortly after to catch any that arrive late.
                const scriptRe = new RegExp({json.dumps(self.SCRIPT_LINE_RE)});
                let knownIds = [];
                try {{ knownIds = JSON.parse(localStorage.getItem('tc_script_line_ids') || '[]'); }} catch(e) {{}}
                const isScriptLine = (s) => {{
                    let id = null, txt = '';
                    try {{ id = s.id(); }} catch(e) {{}}
                    try {{ txt = s.properties().text.value(); }} catch(e) {{}}
                    const horz = /Horizontal|HorzLine/.test(s.name ? s.name() : '');
                    return (id !== null && knownIds.includes(id)) || (horz && scriptRe.test(txt));
                }};
                let removedOld = 0;
                for (let sweep = 0; sweep < 3; sweep++) {{
                    const old = innerModel.allLineTools().filter(isScriptLine);
                    if (old.length) {{ model.removeSources(old); removedOld += old.length; }}
                    if (sweep < 2) await new Promise(r => setTimeout(r, 300));
                }}

                // 2. Draw fresh level lines with ownerSource for symbol binding
                const rawLevels = {json.dumps(levels_to_draw)};
                let count = 0;
                let createdLines = [];
                
                for (let lvl of rawLevels) {{
                    try {{
                        
                        let targetPrice = lvl.price;
                        // Skip corrupted or completely out-of-range prices instead of fabricating synthetic levels
                        if (livePrice && livePrice > 0 && targetPrice > 0) {{
                            let ratio = targetPrice / livePrice;
                            if (ratio > 10 || ratio < 0.1) {{
                                continue;
                            }}
                        }}
                        
                        const nowSec = Math.floor(Date.now() / 1000);
                        const line = model.createLineTool({{
                            pane: pane,
                            point: {{ price: targetPrice, index: barIndex, time: nowSec }},
                            linetool: 'LineToolHorzLine',
                            ownerSource: mainSeries,
                            symbol: mainSeries.symbol()
                        }});
                        
                        if (line && line.properties) {{
                            line.properties().linecolor.setValue(lvl.color);
                            line.properties().linewidth.setValue(2);
                            if (line.properties().text) line.properties().text.setValue(lvl.label);
                            if (line.properties().textcolor) line.properties().textcolor.setValue('#cbd5e1');
                            if (line.properties().visible) line.properties().visible.setValue(true);
                            if (line.properties().showLabel) line.properties().showLabel.setValue(true);
                            if (line.properties().horzLabelsAlign) line.properties().horzLabelsAlign.setValue('right');
                            if (line.properties().frozen) line.properties().frozen.setValue(true);
                            if (line.properties().intervalsVisibilities) {{
                                let iv = line.properties().intervalsVisibilities;
                                ['ticks', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'ranges'].forEach(k => {{
                                    if (iv[k] && typeof iv[k].setValue === 'function') iv[k].setValue(true);
                                }});
                            }}
                            createdLines.push(line);
                            count++;
                        }}
                    }} catch(err) {{}}
                }}
                
                // Record ids so the next clear removes exactly these lines
                try {{
                    let ids = JSON.parse(localStorage.getItem('tc_script_line_ids') || '[]');
                    for (const l of createdLines) {{ try {{ ids.push(l.id()); }} catch(e) {{}} }}
                    localStorage.setItem('tc_script_line_ids', JSON.stringify(ids.slice(-500)));
                }} catch(e) {{}}

                // 3. Force canvas recalculation & render
                if (model.lightUpdate) model.lightUpdate();
                if (innerModel.lightUpdate) innerModel.lightUpdate();

                // 4. Persist drawings via lineToolsSynchronizer
                let sync = widget._lineToolsSynchronizer;
                if (!sync && widget._createLineToolsSynchronizerIfNeeded) {{
                    widget._createLineToolsSynchronizerIfNeeded();
                    sync = widget._lineToolsSynchronizer;
                }}
                if (sync) {{
                    for (let line of createdLines) {{
                        if (sync._invalidateLineToolOrStudyStub) {{
                            sync._invalidateLineToolOrStudyStub(line);
                        }}
                    }}
                    if (sync.flushPendingSavings) {{
                        await sync.flushPendingSavings();
                    }}
                }}
                
                
                return "PERSISTED_AND_DRAWN_" + count + "_REMOVED_OLD_" + removedOld;
            }} catch(e) {{
                return "DRAW_ERR: " + e.message;
            }}
        }})()
        """
        
        result = self.execute_cdp_command(ws_url, js_draw, timeout=20)
        self.log(f"Drawing result for {ticker}: {result}")
        return result

    def refresh_wall_lines(self, ws_url, ticker, dom_data):
        """Redraw the level lines from a freshly fetched option chain so they match the DOM.
        Only for tickers whose levels were drawn before; reuses that draw's gamma flip."""
        if ticker not in self.gamma_cache or not isinstance(dom_data, dict) or not dom_data.get("0dte"):
            return None
        levels, _ = self.build_engine_levels(ws_url, ticker, dom_data)
        return self.draw_level_lines(ws_url, ticker, levels) if levels else None

    def clear_drawings_on_active_chart(self, ws_url):
        js_clear = """
        (async function() {
            try {
                function getCwc() {
                    if (window._exposed_chartWidgetCollection) return window._exposed_chartWidgetCollection;
                    if (window.chartWidgetCollection) return window.chartWidgetCollection;
                    for (let i = 0; i < window.frames.length; i++) {
                        try {
                            if (window.frames[i]._exposed_chartWidgetCollection) return window.frames[i]._exposed_chartWidgetCollection;
                            if (window.frames[i].chartWidgetCollection) return window.frames[i].chartWidgetCollection;
                        } catch(e) {}
                    }
                    return null;
                }
                
                let cwc = null;
                for (let i = 0; i < 20; i++) {
                    cwc = getCwc();
                    if (cwc && cwc.activeChartWidget && cwc.activeChartWidget.value()) break;
                    await new Promise(r => setTimeout(r, 300));
                }
                if (!cwc) return "NO_CWC";
                
                const widget = cwc.activeChartWidget.value();
                if (!widget) return "NO_WIDGET";
                const model = widget.model();
                const innerModel = model.model();
                
                let allTools = innerModel.allLineTools ? innerModel.allLineTools() : [];
                
                // Collect horizontal line sources — actual TV name is 'Horizontal line', not 'LineToolHorzLine'
                let toRemove = [];
                for (let s of allTools) {
                    let nm = s.name ? s.name() : '';
                    if (nm === 'Horizontal line' || nm === 'LineToolHorzLine' || nm.includes('Horizontal')) {
                        toRemove.push(s);
                    }
                }
                
                let removed = toRemove.length;
                
                // Use model.removeSources() — the native batch removal API that actually works
                if (toRemove.length > 0 && model.removeSources) {
                    model.removeSources(toRemove);
                } else if (toRemove.length > 0) {
                    for (let s of toRemove) {
                        try { model.removeSource(s); } catch(e) {}
                    }
                }
                
                return "CLEARED_" + removed;
            } catch(e) {
                return "CLEAR_ERR: " + e.message;
            }
        })()
        """
        return self.execute_cdp_command(ws_url, js_clear)

    def clear_watchlist_drawings(self, list_name):
        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log(f"Fetching '{list_name}' Watchlist 🧹 tickers from TradingView...")
        tickers = self.fetch_watchlist_by_name_from_tv(list_name)
        if not tickers and list_name.lower() == "red list":
            tickers = self.fetch_red_list_from_tv()
        if not tickers and list_name.lower() == "indexes":
            tickers = ["SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV"]

        if not tickers:
            self.log(f"No tickers found for '{list_name}' watchlist to clear.")
            return

        self.log(f"Starting bulk clearance of drawings for {len(tickers)} '{list_name}' tickers: {', '.join(tickers)}")

        def run_clear():
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            count = 0
            for t in tickers:
                self.log(f"[{count+1}/{len(tickers)}] Clearing drawings for: {t}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, t)
                time.sleep(1.2)
                res = self.clear_drawings_on_active_chart(self.tv_ws_url)
                self.log(f"Clear result for {t}: {res}")
                time.sleep(0.3)
                count += 1

            if initial_ticker:
                self.log(f"Restoring active chart to initial ticker: {initial_ticker}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, initial_ticker)

            self.log(f"Bulk clear complete for '{list_name}' watchlist! {count} tickers processed.")
            messagebox.showinfo("Clear Complete", f"Drawings cleared across all {count} '{list_name}' tickers!")

        threading.Thread(target=run_clear, daemon=True).start()

    def clear_red_list_drawings(self):
        self.clear_watchlist_drawings("Red list")

    def clear_indexes_list_drawings(self):
        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log("Fetching 'Economic' category tickers 🧹 to clear drawings...")
        tickers = ["SPY", "QQQ", "NIKKEI", "RUSSELL", "XLI", "XLV", "XLE", "DBC", "XLK", "XLB", "ICLN", "XLRE", "XLU"]

        self.log(f"Starting bulk clearance of drawings for {len(tickers)} 'Economic' tickers: {', '.join(tickers)}")

        def run_clear():
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            count = 0
            for t in tickers:
                self.log(f"[{count+1}/{len(tickers)}] Clearing drawings for: {t}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, t)
                time.sleep(1.2)
                res = self.clear_drawings_on_active_chart(self.tv_ws_url)
                self.log(f"Clear result for {t}: {res}")
                time.sleep(0.3)
                count += 1

            if initial_ticker:
                self.log(f"Restoring active chart to initial ticker: {initial_ticker}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, initial_ticker)

            self.log(f"Bulk clear complete for 'Economic' tickers! {count} tickers processed.")
            messagebox.showinfo("Clear Complete", f"Drawings cleared across all {count} 'Economic' tickers!")

        threading.Thread(target=run_clear, daemon=True).start()

    def fetch_favorited_hotlists_tickers_from_tv(self):
        js = """
        (async function() {
            try {
                let tvSettingsMod = null;
                let hotlistsMod = null;
                
                if (window.webpackChunktradingview) {
                    window.webpackChunktradingview.push([[997111], {}, function(req) {
                        for (let id in req.m) {
                            try {
                                let exp = req(id);
                                if (exp && exp.getValue && exp.setValue && exp.onSync) {
                                    tvSettingsMod = exp;
                                }
                            } catch(e) {}
                        }
                        try { hotlistsMod = req(169213); } catch(e) {}
                    }]);
                }
                
                if (!tvSettingsMod || !hotlistsMod || !hotlistsMod.hotlistsManager) return [];
                
                let favs = tvSettingsMod.getValue("symbol-lists.favorites") || [];
                if (typeof favs === 'string') {
                    try { favs = JSON.parse(favs); } catch(e) {}
                }
                
                let hotFavs = favs.filter(f => f && (f.type === 'hot' || (f.id && String(f.id).includes('###HOT###'))));
                let mgr = hotlistsMod.hotlistsManager();
                let allTickers = [];
                
                for (let item of hotFavs) {
                    let ex = item.exchange || "US";
                    let grp = item.group || (item.id ? item.id.split('.').pop() : "");
                    if (grp === "gap_loosers") grp = "gap_losers";
                    if (grp === "percent_change_loosers") grp = "percent_change_losers";
                    
                    try {
                        let symbols = await mgr.getOneHotlist(undefined, ex, grp, 20);
                        if (symbols && symbols.length) {
                            for (let s of symbols) {
                                let rawName = s.s || s.name || s.symbol || (typeof s === 'string' ? s : '');
                                if (rawName) {
                                    let clean = rawName.split(":").pop().trim().toUpperCase().replace(/[^A-Z]/g, '');
                                    if (clean && !allTickers.includes(clean)) allTickers.push(clean);
                                }
                            }
                        }
                    } catch(e) {}
                }
                return allTickers;
            } catch(e) {
                return [];
            }
        })()
        """
        raw_list = self.execute_cdp_command(self.tv_ws_url, js)
        if raw_list and isinstance(raw_list, list):
            return [str(t).strip().upper() for t in raw_list if t]
        return []

    def toggle_sync_favorited_hotlists(self):
        if self.sync_active:
            self.sync_active = False
            self.log("Stopping Favorited Categories sync...")
            self.sync_fav_btn.config(
                text="★ Sync Favorited Categories (All-in-One)",
                bg="#d97706",
                activebackground="#b45309"
            )
            return

        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log("Fetching all ★ Favorited Categories tickers from TradingView...")
        fav_tickers = self.fetch_favorited_hotlists_tickers_from_tv()

        if not fav_tickers:
            self.log("No favorited categories detected in TradingView. Using default market movers...")
            fav_tickers = ["NVDA", "TSLA", "AAPL", "AMD", "META", "MSFT", "AMZN", "GOOGL", "PLTR", "SOFI"]

        self.sync_active = True
        self.sync_fav_btn.config(
            text="⛔ Stop Category Sync",
            bg="#dc2626",
            activebackground="#b91c1c"
        )
        self.log(f"Starting all-in-one bulk sync for {len(fav_tickers)} tickers across all favorited categories: {', '.join(fav_tickers)}")

        def run_bulk():
            count = 0
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            
            for t in fav_tickers:
                if not self.sync_active:
                    self.log("Favorited Categories sync stopped by user.")
                    break
                self.log(f"[{count+1}/{len(fav_tickers)}] Syncing drawings for: {t}...")
                
                self.switch_tv_chart_symbol(self.tv_ws_url, t)
                time.sleep(0.8)
                
                self.draw_levels_for_ticker(self.tv_ws_url, t)
                
                for _ in range(4):
                    if not self.sync_active:
                        break
                    time.sleep(0.1)
                count += 1

            if initial_ticker and self.sync_active:
                self.log(f"Restoring active chart to initial ticker: {initial_ticker}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, initial_ticker)
                time.sleep(0.5)
                self.draw_levels_for_ticker(self.tv_ws_url, initial_ticker)

            if self.sync_active:
                self.log(f"Favorited Categories bulk sync completed. All {count} tickers drawn!")
                messagebox.showinfo("Sync Complete", f"Category sync complete for {count} tickers across all favorited categories!")

            self.sync_active = False
            self.current_ticker = None
            self.root.after(0, lambda: self.sync_fav_btn.config(
                text="★ Sync Favorited Categories (All-in-One)",
                bg="#d97706",
                activebackground="#b45309"
            ))
            
            if not self.is_tracking:
                self.root.after(500, self.force_start_tracker)

        threading.Thread(target=run_bulk, daemon=True).start()

    def clear_favorited_hotlists_drawings(self):
        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log("Fetching all ★ Favorited Categories 🧹 tickers to clear drawings...")
        tickers = self.fetch_favorited_hotlists_tickers_from_tv()

        if not tickers:
            self.log("No tickers found in favorited categories to clear.")
            return

        self.log(f"Starting bulk clearance of drawings for {len(tickers)} tickers across favorited categories: {', '.join(tickers)}")

        def run_clear():
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            count = 0
            for t in tickers:
                self.log(f"[{count+1}/{len(tickers)}] Clearing drawings for: {t}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, t)
                time.sleep(1.2)
                res = self.clear_drawings_on_active_chart(self.tv_ws_url)
                self.log(f"Clear result for {t}: {res}")
                time.sleep(0.3)
                count += 1

            if initial_ticker:
                self.log(f"Restoring active chart to initial ticker: {initial_ticker}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, initial_ticker)

            self.log(f"Bulk clear complete for favorited categories! {count} tickers processed.")
            messagebox.showinfo("Clear Complete", f"Drawings cleared across all {count} favorited category tickers!")

        threading.Thread(target=run_clear, daemon=True).start()

    def toggle_tracking(self):
        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        if self.is_tracking:
            self.is_tracking = False
            self.sync_active = False
            self.track_btn.configure(text="Start Ticker Tracker (Auto-Draw)", bg="#10b981", fg="#fff")
            self.status_lbl.configure(text="Status: Tracking Stopped")
            self.log("Ticker tracker stopped.")
        else:
            self.is_tracking = True
            self.track_btn.configure(text="Stop Ticker Tracker", bg="#ef4444", fg="#fff")
            self.status_lbl.configure(text="Status: Tracking Active Chart...")
            self.log("Ticker tracker started! Monitoring chart...")
            
            self.tracker_thread = threading.Thread(target=self.run_tracker, daemon=True)
            self.tracker_thread.start()

    def run_tracker(self):
        while self.is_tracking:
            try:
                if self.tv_ws_url:
                    ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
                    # Redraw every 5 min too: 0DTE volume and the opening range change through the session
                    due = time.time() - self._last_draw > 300
                    if ticker and (ticker != self.current_ticker or due):
                        if ticker != self.current_ticker:
                            self.log(f"Symbol change detected: {self.current_ticker} -> {ticker}")
                        self._last_draw = time.time()
                        self.current_ticker = ticker
                        ws_now = self.tv_ws_url
                        self.root.after(0, lambda t=ticker: self.status_lbl.configure(text=f"Status: Active Ticker ({t})"))
                        threading.Thread(
                            target=self.draw_levels_for_ticker,
                            args=(ws_now, ticker),
                            daemon=True
                        ).start()
            except Exception as e:
                self.log(f"Tracker error: {e}")
            time.sleep(0.15)

    def fetch_watchlist_by_name_from_tv(self, list_name):
        js = f"""
        (async function() {{
            try {{
                let targetMod = null;
                if (window.webpackChunktradingview) {{
                    window.webpackChunktradingview.push([[999919], {{}}, function(req) {{
                        for (let id in req.m) {{
                            try {{
                                let exp = req(id);
                                if (exp && exp.getAllWatchLists) {{
                                    targetMod = exp;
                                    break;
                                }}
                            }} catch(e) {{}}
                        }}
                    }}]);
                }}
                if (!targetMod) return null;
                let allLists = await targetMod.getAllWatchLists();
                if (!allLists) return null;
                let match = allLists.find(l => (l.name || l.title || '').toLowerCase() === "{list_name}".toLowerCase());
                if (!match || !match.symbols) return null;
                return match.symbols;
            }} catch(e) {{
                return null;
            }}
        }})()
        """
        raw_list = self.execute_cdp_command(self.tv_ws_url, js)
        if raw_list and isinstance(raw_list, list):
            cleaned = []
            for item in raw_list:
                if isinstance(item, str) and not item.startswith('#'):
                    t = self.clean_symbol(item)
                    if t and t not in cleaned:
                        cleaned.append(t)
            return cleaned
        return []

    def fetch_red_list_from_tv(self):
        # Try fetching by Watchlist title first
        tickers = self.fetch_watchlist_by_name_from_tv("Red list")
        if tickers:
            return tickers
            
        # Fallback to marked symbols service
        js = """
        (function() {
            try {
                let markMod = null;
                if (window.webpackChunktradingview) {
                    try {
                        window.webpackChunktradingview.push([[999993], {}, function(req) {
                            if (req && req.m) {
                                if (req.m[144683]) {
                                    try { markMod = req(144683); } catch(e) {}
                                }
                                if (!markMod || !markMod.getMarkedSymbolsListServiceInstance) {
                                    for (let id in req.m) {
                                        try {
                                            let exp = req(id);
                                            if (exp && typeof exp.getMarkedSymbolsListServiceInstance === 'function') {
                                                markMod = exp;
                                                break;
                                            }
                                        } catch(e) {}
                                    }
                                }
                            }
                        }]);
                    } catch(e) {}
                }
                if (markMod && typeof markMod.getMarkedSymbolsListServiceInstance === 'function') {
                    let inst = markMod.getMarkedSymbolsListServiceInstance();
                    if (inst && typeof inst.getSymbolsByColor === 'function') {
                        return inst.getSymbolsByColor('red');
                    }
                }
                return null;
            } catch(e) {
                return null;
            }
        })()
        """
        raw_list = self.execute_cdp_command(self.tv_ws_url, js)
        if raw_list and isinstance(raw_list, list):
            cleaned = []
            for item in raw_list:
                if isinstance(item, str) and not item.startswith('#'):
                    t = self.clean_symbol(item)
                    if t and t not in cleaned:
                        cleaned.append(t)
            return cleaned
        return []

    def fetch_section_tickers_from_tv(self, watchlist_name="Economic", section_name="INDEXES"):
        """
        Navigates to the specified watchlist/category (e.g. 'Economic'),
        activates it in TradingView, and extracts all tickers belonging to
        the specified section (e.g. 'INDEXES'), along with SPY and QQQ.
        """
        js = f"""
        (async function() {{
            try {{
                let targetMod = null;
                if (window.webpackChunktradingview) {{
                    window.webpackChunktradingview.push([[999919], {{}}, function(req) {{
                        for (let id in req.m) {{
                            try {{
                                let exp = req(id);
                                if (exp && (exp.getAllWatchLists || exp.getAllWatchlists)) {{
                                    targetMod = exp;
                                    break;
                                }}
                            }} catch(e) {{}}
                        }}
                    }}]);
                }}
                
                let allLists = null;
                if (targetMod) {{
                    if (typeof targetMod.getAllWatchLists === 'function') {{
                        allLists = await targetMod.getAllWatchLists();
                    }} else if (typeof targetMod.getAllWatchlists === 'function') {{
                        allLists = await targetMod.getAllWatchlists();
                    }}
                }}
                
                let match = null;
                if (allLists && Array.isArray(allLists)) {{
                    match = allLists.find(l => {{
                        let name = (l.name || l.title || '').trim().toLowerCase();
                        return name === "{watchlist_name}".toLowerCase() || name.includes("{watchlist_name}".toLowerCase());
                    }});
                    
                    // Activate/switch to this watchlist in TradingView so it navigates to the category
                    if (match && targetMod) {{
                        try {{
                            if (typeof targetMod.setActiveWatchList === 'function') {{
                                targetMod.setActiveWatchList(match.id || match);
                            }} else if (typeof targetMod.setActiveWatchListId === 'function') {{
                                targetMod.setActiveWatchListId(match.id);
                            }} else if (typeof targetMod.setActiveList === 'function') {{
                                targetMod.setActiveList(match.id || match);
                            }} else if (typeof targetMod.setActiveListId === 'function') {{
                                targetMod.setActiveListId(match.id);
                            }}
                        }} catch(e) {{}}
                    }}
                }}

                // Ensure right sidebar watchlist is open
                try {{
                    let rightArea = document.querySelector('[class*="layout__area--right"]');
                    if (!rightArea || rightArea.offsetWidth < 50) {{
                        let btn = document.querySelector('[data-name="base-watchlist-widget-button"]') ||
                                  document.querySelector('[aria-label*="Watchlist"]');
                        if (btn) btn.click();
                    }}
                }} catch(e) {{}}

                // Method 1: Extract symbols from the internal watchlist object
                if (match && match.symbols && Array.isArray(match.symbols)) {{
                    let symbols = match.symbols;
                    let inSection = false;
                    let extracted = [];
                    
                    for (let i = 0; i < symbols.length; i++) {{
                        let item = symbols[i];
                        if (typeof item !== 'string') continue;
                        
                        if (item.startsWith('#')) {{
                            let cleanHeader = item.replace(/^#+/, '').trim().toLowerCase();
                            if (cleanHeader === "{section_name}".toLowerCase() || cleanHeader.includes("{section_name}".toLowerCase())) {{
                                inSection = true;
                                continue;
                            }} else if (inSection) {{
                                // Reached the next section divider
                                break;
                            }}
                        }} else if (inSection) {{
                            extracted.push(item);
                        }}
                    }}
                    
                    if (extracted.length > 0) {{
                        return {{
                            source: "internal_section",
                            watchlist: match.name || match.title || "{watchlist_name}",
                            symbols: extracted
                        }};
                    }}
                }}

                // Method 2: DOM fallback from the active watchlist widget
                let domSymbols = [];
                let inDomSection = false;
                let rows = Array.from(document.querySelectorAll('[class*="row-"], [class*="item-"], [class*="section-"], [class*="separator-"], [class*="symbol-"]'));
                
                for (let r of rows) {{
                    let text = (r.textContent || '').trim().toUpperCase();
                    if (text.includes("{section_name}".toUpperCase())) {{
                        inDomSection = true;
                        continue;
                    }}
                    if (inDomSection) {{
                        let cls = (r.className || '').toString().toLowerCase();
                        if (cls.includes('section') || cls.includes('separator') || text.startsWith('###')) {{
                            break;
                        }}
                        let symEl = r.querySelector('[data-symbol-full]') || 
                                    r.querySelector('[class*="symbolName-"]') || 
                                    r.querySelector('[class*="symbol-"]');
                        if (symEl) {{
                            let s = symEl.getAttribute('data-symbol-full') || symEl.textContent.trim();
                            if (s) domSymbols.push(s);
                        }}
                    }}
                }}

                if (domSymbols.length > 0) {{
                    return {{
                        source: "dom_section",
                        watchlist: "{watchlist_name}",
                        symbols: domSymbols
                    }};
                }}

                // Method 3: If match was found but no explicit section matched, return all watchlist symbols
                if (match && match.symbols && Array.isArray(match.symbols)) {{
                    return {{
                        source: "internal_full_watchlist",
                        watchlist: match.name || match.title || "{watchlist_name}",
                        symbols: match.symbols
                    }};
                }}

                // Method 4: Scan active watchlist DOM elements directly
                let dsShort = Array.from(document.querySelectorAll('[data-symbol-short]'));
                let dsList = dsShort.map(e => e.getAttribute('data-symbol-short')).filter(Boolean);
                if (dsList.length > 0) {{
                    return {{
                        source: "dom_data_symbol_short",
                        watchlist: "{watchlist_name}",
                        symbols: dsList
                    }};
                }}

                return null;
            }} catch(e) {{
                return {{ error: e.message }};
            }}
        }})()
        """
        raw_res = self.execute_cdp_command(self.tv_ws_url, js)
        raw_symbols = []
        if isinstance(raw_res, dict):
            raw_symbols = raw_res.get("symbols", [])
            source = raw_res.get("source", "unknown")
            wl_name = raw_res.get("watchlist", watchlist_name)
            self.log(f"TradingView returned {len(raw_symbols)} items via {source} from '{wl_name}'.")
        elif isinstance(raw_res, list):
            raw_symbols = raw_res

        cleaned = []
        for item in raw_symbols:
            if isinstance(item, str) and not item.startswith('#'):
                t = item.split(":")[-1].strip().upper()
                t = re.sub(r'[^A-Z0-9]', '', t)
                if t and t not in cleaned:
                    cleaned.append(t)

        # Exclude commodities, metals, and currencies (e.g. WTI, BRENT, XAUUSD)
        NON_INDEX = {"WTI", "BRENT", "XAUUSD", "XAGUSD", "DXY", "CL", "NG", "HG"}
        cleaned = [t for t in cleaned if t not in NON_INDEX and not t.endswith('!') and 'SAHM' not in t and 'SPC' not in t]

        # Always include all Economic category tickers from user's watchlist
        economic_default = ["SPY", "QQQ", "NIKKEI", "RUSSELL", "XLI", "XLV", "XLE", "DBC", "XLK", "XLB", "ICLN", "XLRE", "XLU"]
        for req in economic_default:
            if req not in cleaned:
                cleaned.append(req)

        return cleaned

    def toggle_sync_indexes_watchlist(self):
        if self.sync_active:
            self.sync_active = False
            self.log("Stopping Indexes sync...")
            self.sync_indexes_btn.config(
                text="Sync Indexes (Auto-Draw)",
                bg="#8b5cf6",
                activebackground="#7c3aed"
            )
            return

        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log("Navigating to 'Economic' category in TradingView & reading tickers...")
        indexes_tickers = self.fetch_section_tickers_from_tv("Economic", "INDEXES")

        economic_default = ["SPY", "QQQ", "NIKKEI", "RUSSELL", "XLI", "XLV", "XLE", "DBC", "XLK", "XLB", "ICLN", "XLRE", "XLU"]
        if not indexes_tickers:
            indexes_tickers = economic_default
        else:
            for req in economic_default:
                if req not in indexes_tickers:
                    indexes_tickers.append(req)

        self.sync_active = True
        self.sync_indexes_btn.config(
            text="⛔ Stop Indexes Sync",
            bg="#dc2626",
            activebackground="#b91c1c"
        )
        self.log(f"Starting bulk sync & level analysis for {len(indexes_tickers)} tickers in 'Economic': {', '.join(indexes_tickers)}")

        def run_bulk():
            count = 0
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            
            for t in indexes_tickers:
                if not self.sync_active:
                    self.log("Indexes sync stopped by user.")
                    break

                if t in {"WTI", "BRENT", "XAUUSD", "XAGUSD", "DXY"}:
                    self.log(f"Encountered non-index ticker {t}. Skipping.")
                    continue

                self.log(f"[{count+1}/{len(indexes_tickers)}] Syncing drawings for: {t}...")
                
                self.switch_tv_chart_symbol(self.tv_ws_url, t)
                time.sleep(0.8)
                
                self.draw_levels_for_ticker(self.tv_ws_url, t)
                
                for _ in range(4):
                    if not self.sync_active:
                        break
                    time.sleep(0.1)
                count += 1

            if initial_ticker and self.sync_active:
                self.log(f"Restoring active chart to initial ticker: {initial_ticker}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, initial_ticker)
                time.sleep(0.5)
                self.draw_levels_for_ticker(self.tv_ws_url, initial_ticker)

            if self.sync_active:
                self.log(f"'Economic' category sync completed. All {count} tickers analysed and drawn!")
                messagebox.showinfo("Sync Complete", f"Watchlist sync complete for {count} tickers in 'Economic' category!")

            self.sync_active = False
            self.current_ticker = None
            self.root.after(0, lambda: self.sync_indexes_btn.config(
                text="Sync Indexes (Auto-Draw)",
                bg="#8b5cf6",
                activebackground="#7c3aed"
            ))
            
            if not self.is_tracking:
                self.root.after(500, self.force_start_tracker)

        threading.Thread(target=run_bulk, daemon=True).start()

    def toggle_sync_watchlist(self):
        if self.sync_active:
            self.sync_active = False
            self.log("Stopping watchlist sync...")
            self.sync_btn.config(
                text="Sync Red List Watchlist (Bulk Auto-Draw)",
                bg="#ef4444",
                activebackground="#dc2626"
            )
            return

        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log("Fetching Red List 🚩 tickers from TradingView...")
        red_tickers = self.fetch_red_list_from_tv()

        if not red_tickers:
            self.log("No Red List tickers detected in TradingView. Using default watch tickers...")
            red_tickers = ["NVDA", "AAPL", "AMZN", "MSFT", "TSLA", "SPY", "QQQ"]

        self.sync_active = True
        self.sync_btn.config(
            text="⛔ Stop Watchlist Sync",
            bg="#dc2626",
            activebackground="#b91c1c"
        )
        self.log(f"Starting bulk sync for {len(red_tickers)} Red List tickers: {', '.join(red_tickers)}")

        def run_bulk():
            count = 0
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            
            for t in red_tickers:
                if not self.sync_active:
                    self.log("Watchlist sync stopped by user.")
                    break
                self.log(f"[{count+1}/{len(red_tickers)}] Syncing drawings for: {t}...")
                
                self.switch_tv_chart_symbol(self.tv_ws_url, t)
                time.sleep(0.8)
                
                self.draw_levels_for_ticker(self.tv_ws_url, t)
                
                for _ in range(4):
                    if not self.sync_active:
                        break
                    time.sleep(0.1)
                count += 1

            if initial_ticker and self.sync_active:
                self.log(f"Restoring active chart to initial ticker: {initial_ticker}...")
                self.switch_tv_chart_symbol(self.tv_ws_url, initial_ticker)
                time.sleep(0.5)
                self.draw_levels_for_ticker(self.tv_ws_url, initial_ticker)

            if self.sync_active:
                self.log(f"Red List Watchlist sync completed. All {count} tickers drawn!")
                messagebox.showinfo("Sync Complete", f"Watchlist sync complete for {count} Red List tickers!")

            self.sync_active = False
            self.current_ticker = None  # Reset current ticker so next click draws immediately
            self.root.after(0, lambda: self.sync_btn.config(
                text="Sync Red List Watchlist (Bulk Auto-Draw)",
                bg="#ef4444",
                activebackground="#dc2626"
            ))
            
            # Automatically resume live chart tracking
            if not self.is_tracking:
                self.root.after(500, self.force_start_tracker)

        threading.Thread(target=run_bulk, daemon=True).start()

def get_tradingview_executable_path():
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "(Get-AppxPackage *TradingView*).InstallLocation"],
            capture_output=True,
            text=True,
            timeout=5
        )
        install_loc = res.stdout.strip()
        if install_loc:
            exe_path = os.path.join(install_loc, "TradingView.exe")
            if os.path.exists(exe_path):
                return exe_path
    except Exception:
        pass

    local_path = os.path.expandvars(r"%LocalAppData%\Programs\TradingView\TradingView.exe")
    if os.path.exists(local_path):
        return local_path

    return None

if __name__ == "__main__":
    print("Shutting down background TradingView processes...")
    subprocess.run(["taskkill", "/f", "/im", "TradingView.exe"], capture_output=True, text=True)
    subprocess.run(["taskkill", "/f", "/im", "Tradingview.exe"], capture_output=True, text=True)
    
    print("Launching TradingView Desktop with debugging enabled...")
    tv_path = get_tradingview_executable_path()
    if tv_path:
        print(f"Found TradingView executable at: {tv_path}")
        launch_cmd = f'start "" "{tv_path}" --remote-debugging-port=9222 --remote-allow-origins=*'
        try:
            subprocess.Popen(launch_cmd, shell=True)
            print("Successfully sent launch command via Windows shell.")
        except Exception as e:
            print(f"Failed to start TradingView via shell: {e}")
    else:
        print("Warning: Could not automatically locate TradingView.exe. Please ensure TradingView is installed.")
        
    print("Waiting 4 seconds for TradingView to initialize...")
    time.sleep(4)
    
    # Hide the console window now that TradingView is initialized
    try:
        import ctypes
        import ctypes.wintypes
        
        # 1. Primary: Direct console window handle
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
            
        # 2. Secondary: Fallback enumeration by process ID
        curr_pid = ctypes.windll.kernel32.GetCurrentProcessId()
        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
        def enum_cb(h, lparam):
            pid = ctypes.wintypes.DWORD()
            ctypes.windll.user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            if pid.value == curr_pid:
                class_buff = ctypes.create_unicode_buffer(256)
                ctypes.windll.user32.GetClassNameW(h, class_buff, 256)
                if 'Console' in class_buff.value or 'Terminal' in class_buff.value or 'Window' in class_buff.value:
                    ctypes.windll.user32.ShowWindow(h, 0)
            return True
        ctypes.windll.user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    except Exception:
        pass

    root = tk.Tk()
    root.deiconify()
    root.lift()
    root.attributes('-topmost', True)
    root.after_idle(root.attributes, '-topmost', False)
    root.focus_force()
    app = TradingViewAutomatorApp(root)
    root.mainloop()
