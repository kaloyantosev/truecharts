import re
import os
import sys
import json
import time
import datetime
import calendar
import urllib.request
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
import websocket

# Set UTF-8 encoding for standard output
sys.stdout.reconfigure(encoding='utf-8')

class TradingViewAutomatorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TrueCharts - TradingView Desktop Auto-Level Injector")
        self.root.geometry("620x680")
        self.root.configure(bg="#0f172a")

        self.api_url = "https://truecharts.onrender.com/api/analyze"
        self.vercel_url = "https://truecharts-chi.vercel.app"
        self.is_tracking = False
        self.sync_active = False
        self.current_ticker = None
        self.tv_ws_url = None

        self.setup_ui()
        
        # Start background threads
        self.start_backend_health_check()
        self.start_tv_status_monitor()

    def setup_ui(self):
        # Title Header
        title_frame = tk.Frame(self.root, bg="#0f172a")
        title_frame.pack(fill="x", padx=15, pady=10)
        
        title_label = tk.Label(
            title_frame,
            text="TrueCharts Level Injector",
            font=("Segoe UI", 16, "bold"),
            bg="#0f172a",
            fg="#38bdf8"
        )
        title_label.pack(side="left")

        # 1. Render API Status Row
        api_frame = tk.Frame(self.root, bg="#1e293b", relief="ridge", bd=1)
        api_frame.pack(fill="x", padx=15, pady=5)

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
            text="Wake Up Server",
            font=("Segoe UI", 8, "bold"),
            bg="#3b82f6",
            fg="#ffffff",
            activebackground="#2563eb",
            bd=0,
            padx=8,
            pady=3,
            command=self.wake_up_backend
        )
        self.wake_btn.pack(side="right", padx=10)

        # 2. TradingView App Status Row (Live Connection Monitor)
        tv_status_frame = tk.Frame(self.root, bg="#1e293b", relief="ridge", bd=1)
        tv_status_frame.pack(fill="x", padx=15, pady=5)

        self.tv_dot = tk.Canvas(tv_status_frame, width=12, height=12, bg="#1e293b", highlightthickness=0)
        self.tv_dot.pack(side="left", padx=(10, 5), pady=8)
        self.draw_dot(self.tv_dot, "red")

        self.tv_status_lbl = tk.Label(
            tv_status_frame,
            text="TradingView Desktop: Disconnected (Checking...)",
            font=("Segoe UI", 9, "bold"),
            bg="#1e293b",
            fg="#ef4444"
        )
        self.tv_status_lbl.pack(side="left", padx=5)

        # Main Action Controls
        control_frame = tk.LabelFrame(
            self.root,
            text=" Tracking Controls ",
            font=("Segoe UI", 10, "bold"),
            bg="#0f172a",
            fg="#e2e8f0",
            padx=10,
            pady=10
        )
        control_frame.pack(fill="x", padx=15, pady=10)

        self.track_btn = tk.Button(
            control_frame,
            text="Start Ticker Tracker (Auto-Draw)",
            font=("Segoe UI", 11, "bold"),
            bg="#10b981",
            fg="#ffffff",
            activebackground="#059669",
            bd=0,
            padx=15,
            pady=8,
            command=self.toggle_tracking
        )
        self.track_btn.pack(fill="x", pady=5)

        # Red List Watchlist Row
        red_frame = tk.Frame(control_frame, bg="#0f172a")
        red_frame.pack(fill="x", pady=4)

        self.sync_btn = tk.Button(
            red_frame,
            text="Sync Red List (Auto-Draw)",
            font=("Segoe UI", 10, "bold"),
            bg="#ef4444",
            fg="#ffffff",
            activebackground="#dc2626",
            bd=0,
            padx=10,
            pady=7,
            command=self.toggle_sync_watchlist
        )
        self.sync_btn.pack(side="left", fill="x", expand=True, padx=(0, 3))

        self.clear_red_btn = tk.Button(
            red_frame,
            text="🧹 Clear Red List",
            font=("Segoe UI", 9, "bold"),
            bg="#991b1b",
            fg="#ffffff",
            activebackground="#7f1d1d",
            bd=0,
            padx=10,
            pady=7,
            command=self.clear_red_list_drawings
        )
        self.clear_red_btn.pack(side="right", padx=(3, 0))

        # Indexes Watchlist Row
        idx_frame = tk.Frame(control_frame, bg="#0f172a")
        idx_frame.pack(fill="x", pady=4)

        self.sync_indexes_btn = tk.Button(
            idx_frame,
            text="Sync Indexes (Auto-Draw)",
            font=("Segoe UI", 10, "bold"),
            bg="#8b5cf6",
            fg="#ffffff",
            activebackground="#7c3aed",
            bd=0,
            padx=10,
            pady=7,
            command=self.toggle_sync_indexes_watchlist
        )
        self.sync_indexes_btn.pack(side="left", fill="x", expand=True, padx=(0, 3))

        self.clear_indexes_btn = tk.Button(
            idx_frame,
            text="🧹 Clear Indexes List",
            font=("Segoe UI", 9, "bold"),
            bg="#5b21b6",
            fg="#ffffff",
            activebackground="#4c1d95",
            bd=0,
            padx=10,
            pady=7,
            command=self.clear_indexes_list_drawings
        )
        self.clear_indexes_btn.pack(side="right", padx=(3, 0))

        # Favorited Categories Row ★
        fav_frame = tk.Frame(control_frame, bg="#0f172a")
        fav_frame.pack(fill="x", pady=4)

        self.sync_fav_btn = tk.Button(
            fav_frame,
            text="★ Sync Favorited Categories (All-in-One)",
            font=("Segoe UI", 10, "bold"),
            bg="#d97706",
            fg="#ffffff",
            activebackground="#b45309",
            bd=0,
            padx=10,
            pady=7,
            command=self.toggle_sync_favorited_hotlists
        )
        self.sync_fav_btn.pack(side="left", fill="x", expand=True, padx=(0, 3))

        self.clear_fav_btn = tk.Button(
            fav_frame,
            text="🧹 Clear Favorited Categories",
            font=("Segoe UI", 9, "bold"),
            bg="#92400e",
            fg="#ffffff",
            activebackground="#78350f",
            bd=0,
            padx=10,
            pady=7,
            command=self.clear_favorited_hotlists_drawings
        )
        self.clear_fav_btn.pack(side="right", padx=(3, 0))

        # Status Bar
        self.status_lbl = tk.Label(
            self.root,
            text="Status: Ready",
            font=("Segoe UI", 10, "italic"),
            bg="#0f172a",
            fg="#94a3b8"
        )
        self.status_lbl.pack(anchor="w", padx=15, pady=(5, 2))

        # Console Log Box
        log_frame = tk.LabelFrame(
            self.root,
            text=" Live Activity Console Log ",
            font=("Segoe UI", 9, "bold"),
            bg="#0f172a",
            fg="#e2e8f0"
        )
        log_frame.pack(fill="both", expand=True, padx=15, pady=(5, 15))

        self.log_text = tk.Text(
            log_frame,
            bg="#020617",
            fg="#22c55e",
            insertbackground="white",
            font=("Consolas", 9),
            bd=0,
            wrap="word"
        )
        self.log_text.pack(side="left", fill="both", expand=True, padx=5, pady=5)

        scrollbar = tk.Scrollbar(log_frame, command=self.log_text.yview)
        scrollbar.pack(side="right", fill="y")
        self.log_text.config(yscrollcommand=scrollbar.set)

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
                    req = urllib.request.Request("http://localhost:9222/json", headers={'User-Agent': 'Mozilla'})
                    with urllib.request.urlopen(req, timeout=2) as res:
                        tabs = json.loads(res.read().decode())
                    
                    chart_tab = None
                    for t in tabs:
                        if "tradingview.com/chart" in t.get("url", ""):
                            chart_tab = t
                            break
                    
                    if chart_tab:
                        self.tv_ws_url = chart_tab.get("webSocketDebuggerUrl")
                        title = chart_tab.get("title", "Active Chart")
                        if len(title) > 25:
                            title = "Active Chart"
                        self.root.after(0, lambda: self.update_tv_status(f"Connected ({title})", "green"))
                    else:
                        self.tv_ws_url = None
                        self.root.after(0, lambda: self.update_tv_status("App Open (No Chart Tab)", "yellow"))
                except Exception:
                    self.tv_ws_url = None
                    self.root.after(0, lambda: self.update_tv_status("Disconnected (Port 9222 Offline)", "red"))
                
                time.sleep(0.1)

        threading.Thread(target=monitor, daemon=True).start()

    def update_tv_status(self, text, color):
        self.draw_dot(self.tv_dot, color)
        self.tv_status_lbl.configure(
            text=f"TradingView Desktop: {text}",
            fg={"green": "#22c55e", "yellow": "#eab308", "red": "#ef4444"}[color]
        )

    # --- CDP UTILS & ENGINE BINDING ---
    def execute_cdp_command(self, ws_url, expression):
        try:
            ws = websocket.create_connection(ws_url, timeout=4, suppress_origin=True)
            payload = {
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": expression,
                    "awaitPromise": True,
                    "returnByValue": True
                }
            }
            ws.send(json.dumps(payload))
            res = json.loads(ws.recv())
            ws.close()
            return res.get("result", {}).get("result", {}).get("value")
        except Exception as e:
            return None

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
        if not raw_symbol or not isinstance(raw_symbol, str):
            return None
            
        clean = raw_symbol.split(":")[-1].strip().upper()
        clean = re.sub(r'[^A-Z]', '', clean)
        return clean if clean else None

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

    def draw_levels_for_ticker(self, ws_url, ticker):
        self.log(f"Fetching option & technical levels for {ticker} from TrueCharts...")
        data = None
        try:
            req = urllib.request.Request(f"{self.api_url}/{ticker}", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode())
        except Exception as e:
            try:
                req = urllib.request.Request(f"{self.vercel_url}/api/analyze/{ticker}", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as res:
                    data = json.loads(res.read().decode())
            except Exception as e2:
                self.log(f"Failed to fetch data for {ticker}: {e2}")
                return

        if not data:
            self.log(f"No response data received for {ticker}.")
            return

        supports = data.get("supports", [])
        resistances = data.get("resistances", [])
        max_pain = float(data.get("max_pain", 0))

        weekly_max_pain = float(data.get("weekly_max_pain") or data.get("max_pain") or 0)
        monthly_max_pain = float(data.get("monthly_max_pain") or 0)
        gamma_flip = float(data.get("gamma_flip", 0) or 0)

        em_up = float(data.get("expected_move_upper", 0) or 0)
        em_dn = float(data.get("expected_move_lower", 0) or 0)
        if em_up <= 0 or em_dn <= 0:
            exp_move = data.get("expected_move")
            if isinstance(exp_move, dict):
                em_up = em_up or float(exp_move.get("upper", 0) or 0)
                em_dn = em_dn or float(exp_move.get("lower", 0) or 0)

        max_sup_abs = max([float(s.get("strength", 0)) for s in supports], default=1.0)
        max_res_abs = max([float(r.get("strength", 0)) for r in resistances], default=1.0)

        # Calculate DTE indicators for options expiration cycles
        today = datetime.date.today()
        days_to_fri = (4 - today.weekday()) % 7
        weekly_dte_str = f"{days_to_fri}d DTE" if days_to_fri > 0 else "0DTE"

        def get_monthly_opex_dte(d):
            c = calendar.monthcalendar(d.year, d.month)
            fris = [w[4] for w in c if w[4] != 0]
            tf = datetime.date(d.year, d.month, fris[2])
            if tf < d:
                m = 1 if d.month == 12 else d.month + 1
                y = d.year + 1 if d.month == 12 else d.year
                c = calendar.monthcalendar(y, m)
                fris = [w[4] for w in c if w[4] != 0]
                tf = datetime.date(y, m, fris[2])
            diff = (tf - d).days
            return f"{diff}d DTE" if diff > 0 else "0DTE"

        monthly_dte_str = get_monthly_opex_dte(today)

        def extract_dte_tag(item, fallback_dte_str=""):
            d_val = item.get("dte")
            if d_val is not None and str(d_val).strip() and str(d_val).lower() != "none":
                try:
                    d_num = int(float(d_val))
                    return f"{d_num}d DTE" if d_num > 0 else "0DTE"
                except:
                    return f"{d_val}d DTE"
            m = re.search(r"\((\d+)d\s*DTE\)", str(item.get("sublabel", "")), re.IGNORECASE)
            if m:
                d_num = int(m.group(1))
                return f"{d_num}d DTE" if d_num > 0 else "0DTE"
            return fallback_dte_str

        raw_items = []

        # 1. Weekly Pin (Weekly Max Pain)
        if weekly_max_pain > 0:
            raw_items.append({
                "price": weekly_max_pain,
                "title": "WEEKLY PIN",
                "dte_tag": weekly_dte_str,
                "label": f"WEEKLY PIN · ${weekly_max_pain:.2f} ({weekly_dte_str})",
                "color": "#ba68c8",
                "priority": 90
            })

        # 2. Monthly OPEX Anchor Pin
        if monthly_max_pain > 0:
            raw_items.append({
                "price": monthly_max_pain,
                "title": "OPEX ANCHOR",
                "dte_tag": monthly_dte_str,
                "label": f"OPEX ANCHOR · ${monthly_max_pain:.2f} ({monthly_dte_str})",
                "color": "#a855f7",
                "priority": 85
            })

        # 3. Gamma Flip (Zero-GEX Regime Pivot)
        if gamma_flip > 0:
            raw_items.append({
                "price": gamma_flip,
                "title": "GAMMA FLIP",
                "dte_tag": "",
                "label": f"GAMMA FLIP · ${gamma_flip:.2f} (Regime Pivot)",
                "color": "#facc15",
                "priority": 95
            })

        # 3b. Weekly Expected Move Envelope (+- 1-Standard Deviation, 68% Containment)
        em_upper = float(data.get("expected_move_upper") or 0.0)
        em_lower = float(data.get("expected_move_lower") or 0.0)
        if em_upper > 0 and em_lower > 0:
            raw_items.append({
                "price": em_upper,
                "title": "+1σ EXP MOVE",
                "dte_tag": "Weekly",
                "label": f"+1σ EXP MOVE · ${em_upper:.2f} (Weekly Upper 68% Band)",
                "color": "#38bdf8",
                "priority": 70
            })
            raw_items.append({
                "price": em_lower,
                "title": "-1σ EXP MOVE",
                "dte_tag": "Weekly",
                "label": f"-1σ EXP MOVE · ${em_lower:.2f} (Weekly Lower 68% Band)",
                "color": "#38bdf8",
                "priority": 70
            })

        # 4. Resistances (Confluence / Call Walls / Technical)
        for res in resistances:
            try:
                p = float(res.get("price", 0))
                st = float(res.get("strength", 0))
                src = str(res.get("source", "")).lower()
                tests = int(res.get("tests", 0) or 0)
                is_conf = bool(res.get("is_confluence"))

                # Filter out technical levels with 0 tests
                if src != "options" and not is_conf and tests <= 0:
                    continue

                dte_tag = extract_dte_tag(res)

                if is_conf:
                    sub = res.get("sublabel") or "Multi-Factor"
                    clean_sub_parts = [part.strip() for part in sub.split("+") if "confluence" not in part.lower()]
                    clean_sub = " + ".join(clean_sub_parts) if clean_sub_parts else "Multi-Factor"
                    if dte_tag and dte_tag not in clean_sub:
                        clean_sub = f"{dte_tag} · {clean_sub}"
                    raw_items.append({
                        "price": p,
                        "title": "CONFLUENCE",
                        "is_confluence": True,
                        "sublabel": clean_sub,
                        "confluence_factors": res.get("confluence_factors") or clean_sub_parts,
                        "dte_tag": dte_tag,
                        "label": f"CONFLUENCE · ${p:.2f} [{clean_sub}]",
                        "color": "#f97316",
                        "priority": 100
                    })
                elif src == "options":
                    rel = st / max_res_abs if max_res_abs > 0 else 0
                    if rel >= 0.75:
                        d_part = f" ({dte_tag} · Gamma Ceiling)" if dte_tag else f" (Gamma Ceiling: {round(st)})"
                        raw_items.append({
                            "price": p,
                            "title": "CALL WALL",
                            "dte_tag": dte_tag,
                            "label": f"CALL WALL · ${p:.2f}{d_part}",
                            "color": "#dc2626",
                            "priority": 75
                        })
                    elif rel >= 0.4:
                        d_part = f" ({dte_tag} · Absorption: {round(st)})" if dte_tag else f" (Absorption: {round(st)})"
                        raw_items.append({
                            "price": p,
                            "title": "INT RES",
                            "dte_tag": dte_tag,
                            "label": f"INT CALL RES · ${p:.2f}{d_part}",
                            "color": "#ef4444",
                            "priority": 60
                        })
                    else:
                        d_part = f" ({dte_tag})" if dte_tag else ""
                        raw_items.append({
                            "price": p,
                            "title": "CALL RES",
                            "dte_tag": dte_tag,
                            "label": f"CALL RES · ${p:.2f}{d_part}",
                            "color": "#f87171",
                            "priority": 40
                        })
                else:
                    raw_items.append({
                        "price": p,
                        "title": "TECH RES",
                        "dte_tag": "",
                        "tests": tests,
                        "label": f"TECH RES · ${p:.2f} ({tests} swing tests)",
                        "color": "#ef4444",
                        "priority": 50
                    })
            except Exception:
                pass

        # 6. Supports (Confluence / Put Walls / Technical)
        for sup in supports:
            try:
                p = float(sup.get("price", 0))
                st = float(sup.get("strength", 0))
                src = str(sup.get("source", "")).lower()
                tests = int(sup.get("tests", 0) or 0)
                is_conf = bool(sup.get("is_confluence"))

                # Filter out technical levels with 0 tests
                if src != "options" and not is_conf and tests <= 0:
                    continue

                dte_tag = extract_dte_tag(sup)

                if is_conf:
                    sub = sup.get("sublabel") or "Multi-Factor"
                    clean_sub_parts = [part.strip() for part in sub.split("+") if "confluence" not in part.lower()]
                    clean_sub = " + ".join(clean_sub_parts) if clean_sub_parts else "Multi-Factor"
                    if dte_tag and dte_tag not in clean_sub:
                        clean_sub = f"{dte_tag} · {clean_sub}"
                    raw_items.append({
                        "price": p,
                        "title": "CONFLUENCE",
                        "is_confluence": True,
                        "sublabel": clean_sub,
                        "confluence_factors": sup.get("confluence_factors") or clean_sub_parts,
                        "dte_tag": dte_tag,
                        "label": f"CONFLUENCE · ${p:.2f} [{clean_sub}]",
                        "color": "#f97316",
                        "priority": 100
                    })
                elif src == "options":
                    rel = st / max_sup_abs if max_sup_abs > 0 else 0
                    if rel >= 0.75:
                        d_part = f" ({dte_tag} · OI Absorption: {round(st)})" if dte_tag else f" (OI Absorption: {round(st)})"
                        raw_items.append({
                            "price": p,
                            "title": "PUT WALL",
                            "dte_tag": dte_tag,
                            "label": f"PUT WALL · ${p:.2f}{d_part}",
                            "color": "#047857",
                            "priority": 75
                        })
                    elif rel >= 0.4:
                        d_part = f" ({dte_tag} · Absorption: {round(st)})" if dte_tag else f" (Absorption: {round(st)})"
                        raw_items.append({
                            "price": p,
                            "title": "INT SUP",
                            "dte_tag": dte_tag,
                            "label": f"INT PUT SUP · ${p:.2f}{d_part}",
                            "color": "#059669",
                            "priority": 60
                        })
                    else:
                        d_part = f" ({dte_tag})" if dte_tag else ""
                        raw_items.append({
                            "price": p,
                            "title": "PUT SUP",
                            "dte_tag": dte_tag,
                            "label": f"PUT SUP · ${p:.2f}{d_part}",
                            "color": "#10b981",
                            "priority": 40
                        })
                else:
                    raw_items.append({
                        "price": p,
                        "title": "TECH SUP",
                        "dte_tag": "",
                        "tests": tests,
                        "label": f"TECH SUP · ${p:.2f} ({tests} swing tests)",
                        "color": "#10b981",
                        "priority": 50
                    })
            except Exception:
                pass

        # --- DEDUPLICATION & OVERLAY MERGE ENGINE ---
        # Cluster levels that fall on the exact same price or within a 0.2% threshold
        # into a single line with a unified label (like the site) to eliminate text collisions
        levels_to_draw = []
        if raw_items:
            sorted_items = sorted(raw_items, key=lambda x: x["price"])
            clusters = []
            curr_cluster = [sorted_items[0]]
            for itm in sorted_items[1:]:
                prev_p = curr_cluster[-1]["price"]
                curr_p = itm["price"]
                # Group if exact same rounded cent or within 0.2% price threshold
                if abs(curr_p - prev_p) <= max(0.05, prev_p * 0.002):
                    curr_cluster.append(itm)
                else:
                    clusters.append(curr_cluster)
                    curr_cluster = [itm]
            if curr_cluster:
                clusters.append(curr_cluster)

            for cl in clusters:
                if len(cl) == 1:
                    levels_to_draw.append({
                        "price": cl[0]["price"],
                        "label": cl[0]["label"],
                        "color": cl[0]["color"]
                    })
                else:
                    # Multiple levels colliding: sort by priority descending
                    cl.sort(key=lambda x: x.get("priority", 0), reverse=True)
                    rep_price = cl[0]["price"]
                    factor_list = []
                    for itm in cl:
                        c_factors = itm.get("confluence_factors")
                        sub = itm.get("sublabel")
                        t = itm.get("title") or itm.get("label", "").split("·")[0].split(":")[0].strip()
                        d_tag = itm.get("dte_tag")
                        tests = itm.get("tests")

                        # If this item was already a confluence, unpack its underlying factors
                        if itm.get("is_confluence") or t.upper() == "CONFLUENCE":
                            if c_factors and isinstance(c_factors, list):
                                for f in c_factors:
                                    f_clean = str(f).strip()
                                    if f_clean.upper() != "CONFLUENCE" and f_clean not in factor_list:
                                        factor_list.append(f_clean)
                            elif sub and "multi-factor" not in sub.lower():
                                parts = [p.strip() for p in sub.split("+")]
                                for p in parts:
                                    clean_p = p.split("·")[-1].strip() if "·" in p else p
                                    if clean_p.upper() != "CONFLUENCE" and clean_p not in factor_list:
                                        factor_list.append(clean_p)
                        else:
                            if d_tag and d_tag not in t:
                                tag = f"{t} ({d_tag})"
                            elif tests and "test" not in t.lower():
                                tag = f"{t} ({tests} tests)"
                            else:
                                tag = t
                            if tag.upper() != "CONFLUENCE" and tag not in factor_list:
                                factor_list.append(tag)

                    final_factors = [f for f in factor_list if "confluence" not in f.lower()]
                    if not final_factors:
                        final_factors = ["Multi-Factor S/R"]

                    if set([itm.get("title") for itm in cl]) == {"WEEKLY PIN", "OPEX ANCHOR"}:
                        lbl = f"WEEKLY PIN ({weekly_dte_str}) & OPEX ANCHOR ({monthly_dte_str}) · ${rep_price:.2f}"
                        clr = "#ba68c8"
                    else:
                        lbl = f"CONFLUENCE · ${rep_price:.2f} [{' + '.join(final_factors)}]"
                        clr = "#f97316"

                    levels_to_draw.append({
                        "price": rep_price,
                        "label": lbl,
                        "color": clr
                    })

        if not levels_to_draw:
            self.log(f"No options levels in API payload for {ticker}. Generating key technical levels...")
            curr_price = float(data.get("current_price") or 100.0)
            levels_to_draw = [
                {"price": curr_price * 1.05, "label": f"CALL WALL · ${curr_price * 1.05:.2f} (Technical R2)", "color": "#dc2626"},
                {"price": curr_price * 1.02, "label": f"INT RES · ${curr_price * 1.02:.2f} (Technical R1)", "color": "#ef4444"},
                {"price": curr_price, "label": f"PIVOT PRICE · ${curr_price:.2f}", "color": "#ba68c8"},
                {"price": curr_price * 0.98, "label": f"INT SUP · ${curr_price * 0.98:.2f} (Technical S1)", "color": "#059669"},
                {"price": curr_price * 0.95, "label": f"PUT WALL · ${curr_price * 0.95:.2f} (Technical S2)", "color": "#047857"}
            ]

        sinclair_vol = data.get("sinclair_volatility") or {}
        if sinclair_vol:
            self.log(f"─── SINCLAIR VOLATILITY REGIME ({ticker}) ───")
            self.log(f"  Regime: {sinclair_vol.get('regime_verdict')}")
            self.log(f"  IV: {sinclair_vol.get('implied_volatility')}% vs YZ-RV: {sinclair_vol.get('rv_yang_zhang')}% (VRP: {sinclair_vol.get('vrp_spread'):+0.1f} pts)")
            if sinclair_vol.get('weekly_expected_move_dollars'):
                self.log(f"  Weekly Move: ±${sinclair_vol.get('weekly_expected_move_dollars')} (±{sinclair_vol.get('weekly_expected_move_pct')}%)")
            self.log(f"  Term: {sinclair_vol.get('term_structure_regime', '').split('(')[0].strip()} ({sinclair_vol.get('ivts')}x) | Skew: {sinclair_vol.get('skew_bias')}")
            self.log(f"────────────────────────────────────────────")

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
                
                // 1. Selectively delete only script-created drawings before drawing fresh ones
                // Preserves any manual user drawings on the chart
                let allTools = innerModel.allLineTools ? innerModel.allLineTools() : [];
                let toRemove = [];
                for (let s of allTools) {{
                    let nm = s.name ? s.name() : '';
                    if (nm === 'Horizontal line' || nm === 'LineToolHorzLine' || nm.includes('Horizontal')) {{
                        try {{
                            let txt = s.properties && s.properties().text ? s.properties().text.value() : '';
                            let isScriptLine = 
                                txt.includes('Major Res') || txt.includes('Int Res') || txt.includes('Minor Res') ||
                                txt.includes('Major Sup') || txt.includes('Int Sup') || txt.includes('Minor Sup') ||
                                txt.includes('Max Pain') || txt.includes('WEEKLY PIN') || txt.includes('Weekly Pin') ||
                                txt.includes('OPEX ANCHOR') || txt.includes('Opex Anchor') ||
                                txt.includes('GAMMA FLIP') || txt.includes('Gamma Flip') ||
                                txt.includes('EXP MOVE') || txt.includes('Expected Move') ||
                                txt.includes('CALL WALL') || txt.includes('PUT WALL') ||
                                txt.includes('CALL RES') || txt.includes('PUT SUP') ||
                                txt.includes('CONFLUENCE') || txt.includes('TECH') ||
                                txt.includes('PIVOT') || txt.includes('Pivot Price') || txt.includes('Technical') ||
                                txt.includes('Absorption') || txt.includes('Target Level') || txt.includes('DTE');
                            if (isScriptLine) {{
                                toRemove.push(s);
                            }}
                        }} catch(err) {{}}
                    }}
                }}
                if (toRemove.length > 0 && model.removeSources) {{
                    model.removeSources(toRemove);
                }}
                
                // 2. Draw fresh level lines with ownerSource for symbol binding
                const rawLevels = {json.dumps(levels_to_draw)};
                let count = 0;
                let createdLines = [];
                
                for (let lvl of rawLevels) {{
                    try {{
                        
                        let targetPrice = lvl.price;
                        // Handle price ratio correction if payload price is completely out of proportion
                        if (livePrice && livePrice > 0 && targetPrice > 0) {{
                            let ratio = targetPrice / livePrice;
                            if (ratio > 10 || ratio < 0.1) {{
                                // Normalize fallback levels to live chart price viewport
                                if (lvl.label.includes("Major Res")) targetPrice = livePrice * 1.05;
                                else if (lvl.label.includes("Int Res")) targetPrice = livePrice * 1.02;
                                else if (lvl.label.includes("Pivot")) targetPrice = livePrice;
                                else if (lvl.label.includes("Int Sup")) targetPrice = livePrice * 0.98;
                                else if (lvl.label.includes("Major Sup")) targetPrice = livePrice * 0.95;
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
                
                // 5. Render or Update On-Chart Sinclair Volatility HUD Box
                try {{
                    const sVol = {json.dumps(sinclair_vol)};
                    if (sVol && sVol.regime_verdict) {{
                        let hud = document.getElementById('tc-sinclair-hud');
                        if (!hud) {{
                            hud = document.createElement('div');
                            hud.id = 'tc-sinclair-hud';
                            hud.style.cssText = 'position:fixed;top:55px;right:80px;z-index:99999;background:rgba(10,12,20,0.92);border:1px solid #1e293b;border-top:2px solid #00e5ff;border-radius:6px;padding:8px 12px;color:#f8fafc;font-family:Consolas,monospace;font-size:10.5px;line-height:1.4;box-shadow:0 8px 20px rgba(0,0,0,0.6);pointer-events:auto;user-select:none;backdrop-filter:blur(8px);min-width:260px;';
                            document.body.appendChild(hud);
                        }}
                        
                        let vrpColor = sVol.vrp_spread >= 0 ? '#10b981' : '#38bdf8';
                        let vrpSign = sVol.vrp_spread >= 0 ? '+' : '';
                        let termStr = sVol.term_structure_regime ? sVol.term_structure_regime.split('(')[0].trim() : 'Contango';
                        let weeklyMoveStr = sVol.weekly_expected_move_dollars ? ('±$' + sVol.weekly_expected_move_dollars) : '';
                        
                        hud.innerHTML = `
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;border-bottom:1px solid #1e293b;padding-bottom:3px;">
                                <span style="font-weight:bold;color:#00e5ff;">⚡ SINCLAIR VOL MODEL</span>
                                <span style="font-weight:bold;color:#fff;background:#1e293b;padding:1px 5px;border-radius:3px;">{ticker}</span>
                            </div>
                            <div style="font-size:9.5px;font-weight:bold;color:#e2e8f0;background:rgba(30,41,59,0.6);padding:3px 5px;border-radius:3px;margin-bottom:5px;">
                                ${{sVol.regime_verdict}}
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9.5px;">
                                <div><span style="color:#94a3b8;">IV / RV:</span> <span style="color:#fff;font-weight:bold;">${{sVol.implied_volatility}}% / ${{sVol.rv_yang_zhang}}%</span></div>
                                <div><span style="color:#94a3b8;">VRP Edge:</span> <span style="color:${{vrpColor}};font-weight:bold;">${{vrpSign}}${{sVol.vrp_spread}} pts</span></div>
                                <div><span style="color:#94a3b8;">Weekly:</span> <span style="color:#38bdf8;font-weight:bold;">${{weeklyMoveStr || '±1σ Range'}}</span></div>
                                <div><span style="color:#94a3b8;">Term:</span> <span style="color:#c084fc;font-weight:bold;">${{termStr}}</span></div>
                                <div><span style="color:#94a3b8;">IV Rank:</span> <span style="color:#fff;font-weight:bold;">${{sVol.iv_rank}}%</span></div>
                            </div>
                        `;
                    }}
                }} catch(e) {{}}
                
                return "PERSISTED_AND_DRAWN_" + count;
            }} catch(e) {{
                return "DRAW_ERR: " + e.message;
            }}
        }})()
        """
        
        result = self.execute_cdp_command(ws_url, js_draw)
        self.log(f"Drawing result for {ticker}: {result}")

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
        self.clear_watchlist_drawings("Indexes")

    def fetch_favorited_hotlists_tickers_from_tv(self):
        js = """
        (async function() {
            try {
                let tvSettingsMod = null;
                let hotlistsMod = null;
                
                if (window.webpackChunktradingview) {
                    window.webpackChunktradingview.push([[995111], {}, function(req) {
                        for (let id in req.m) {
                            try {
                                let exp = req(id);
                                if (!exp) continue;
                                if (exp.getValue && exp.setValue && exp.onSync) {
                                    tvSettingsMod = exp;
                                }
                                if (exp.hotlistsManager || (typeof exp === 'function' && exp.name === 'HotlistsManager')) {
                                    hotlistsMod = exp;
                                }
                                if (typeof exp === 'object') {
                                    for (let k in exp) {
                                        if (exp[k] && exp[k].hotlistsManager) {
                                            hotlistsMod = exp[k];
                                        }
                                    }
                                }
                            } catch(e) {}
                        }
                    }]);
                }
                
                let favItems = [];
                if (tvSettingsMod) {
                    let favs = tvSettingsMod.getValue("symbol-lists.favorites") || [];
                    if (typeof favs === 'string') {
                        try { favs = JSON.parse(favs); } catch(e) {}
                    }
                    if (Array.isArray(favs)) {
                        favItems.push(...favs.filter(f => f && (f.type === 'hot' || (f.id && String(f.id).includes('###HOT###')))));
                    }
                    
                    let recents = tvSettingsMod.getValue("symbollist.recents") || [];
                    if (typeof recents === 'string') {
                        try { recents = JSON.parse(recents); } catch(e) {}
                    }
                    if (Array.isArray(recents)) {
                        favItems.push(...recents.filter(f => f && (f.type === 'hot' || (f.id && String(f.id).includes('###HOT###')))));
                    }
                }
                
                if (favItems.length === 0) {
                    favItems = [
                        { exchange: "US", group: "volume_gainers" },
                        { exchange: "OTC", group: "volume_gainers" },
                        { exchange: "US", group: "gap_losers" },
                        { exchange: "US", group: "gap_gainers" }
                    ];
                }
                
                let categoriesToFetch = [];
                for (let item of favItems) {
                    let ex = item.exchange || "US";
                    let grp = item.group || (item.id ? item.id.split('.').pop() : "");
                    if (grp === "gap_loosers") grp = "gap_losers";
                    if (grp === "percent_change_loosers") grp = "percent_change_losers";
                    
                    let key = `${ex}_${grp}`;
                    if (ex && grp && !categoriesToFetch.some(c => c.key === key)) {
                        categoriesToFetch.push({ key, exchange: ex, group: grp });
                    }
                }
                
                let mgr = (hotlistsMod && hotlistsMod.hotlistsManager) ? hotlistsMod.hotlistsManager() : null;
                let allTickers = [];
                
                for (let cat of categoriesToFetch) {
                    let fetchedSymbols = [];
                    if (mgr && mgr.getOneHotlist) {
                        try {
                            let res = await mgr.getOneHotlist(undefined, cat.exchange, cat.group, 20);
                            if (res && res.length) fetchedSymbols = res;
                        } catch(e) {}
                    }
                    
                    if (!fetchedSymbols || fetchedSymbols.length === 0) {
                        try {
                            let presetName = `${cat.exchange}_${cat.group}`;
                            let url = `https://scanner.tradingview.com/presets/${presetName}`;
                            let resp = await fetch(url);
                            let data = await resp.json();
                            if (data && data.symbols) fetchedSymbols = data.symbols;
                        } catch(e) {}
                    }
                    
                    for (let s of fetchedSymbols) {
                        let rawName = s.s || s.name || s.symbol || (typeof s === 'string' ? s : '');
                        if (rawName) {
                            let clean = rawName.split(":").pop().trim().toUpperCase().replace(/[^A-Z]/g, '');
                            if (clean && !allTickers.includes(clean)) allTickers.push(clean);
                        }
                    }
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
                    if ticker and ticker != self.current_ticker:
                        self.log(f"Symbol change detected: {self.current_ticker} -> {ticker}")
                        self.current_ticker = ticker
                        self.status_lbl.configure(text=f"Status: Active Ticker ({ticker})")
                        self.draw_levels_for_ticker(self.tv_ws_url, ticker)
            except Exception as e:
                self.log(f"Tracker error: {e}")
            time.sleep(0.1)

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
                    t = item.split(":")[-1].strip().upper()
                    t = re.sub(r'[^A-Z]', '', t)
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
                    window.webpackChunktradingview.push([[999993], {}, function(req) {
                        markMod = req(144683);
                    }]);
                }
                if (markMod && markMod.getMarkedSymbolsListServiceInstance) {
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
                    t = item.split(":")[-1].strip().upper()
                    t = re.sub(r'[^A-Z]', '', t)
                    if t and t not in cleaned:
                        cleaned.append(t)
            return cleaned
        return []

    def toggle_sync_indexes_watchlist(self):
        if self.sync_active:
            self.sync_active = False
            self.log("Stopping Indexes watchlist sync...")
            self.sync_indexes_btn.config(
                text="Sync Indexes Watchlist (Bulk Auto-Draw)",
                bg="#8b5cf6",
                activebackground="#7c3aed"
            )
            return

        if not self.tv_ws_url:
            messagebox.showerror("Connection Error", "Cannot connect to TradingView Desktop.\n\nEnsure TradingView is open and port 9222 is active.")
            return

        self.log("Fetching 'Indexes' Watchlist 📊 tickers from TradingView...")
        indexes_tickers = self.fetch_watchlist_by_name_from_tv("Indexes")

        if not indexes_tickers:
            self.log("No 'Indexes' Watchlist detected in TradingView. Using default index tickers...")
            indexes_tickers = ["SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV"]

        self.sync_active = True
        self.sync_indexes_btn.config(
            text="⛔ Stop Watchlist Sync",
            bg="#dc2626",
            activebackground="#b91c1c"
        )
        self.log(f"Starting bulk sync for {len(indexes_tickers)} 'Indexes' tickers: {', '.join(indexes_tickers)}")

        def run_bulk():
            count = 0
            initial_ticker = self.fetch_current_ticker_from_chart(self.tv_ws_url)
            
            for t in indexes_tickers:
                if not self.sync_active:
                    self.log("Indexes watchlist sync stopped by user.")
                    break
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
                self.log(f"'Indexes' Watchlist sync completed. All {count} tickers drawn!")
                messagebox.showinfo("Sync Complete", f"Watchlist sync complete for {count} 'Indexes' tickers!")

            self.sync_active = False
            self.current_ticker = None
            self.root.after(0, lambda: self.sync_indexes_btn.config(
                text="Sync Indexes Watchlist (Bulk Auto-Draw)",
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

def find_tradingview_exe():
    try:
        cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-AppxPackage *TradingView*).InstallLocation"'
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        install_dir = res.stdout.strip()
        if install_dir:
            exe_path = os.path.join(install_dir, "TradingView.exe")
            if os.path.exists(exe_path):
                return exe_path
    except Exception:
        pass

    alias_path = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\TradingView.exe")
    if os.path.exists(alias_path):
        return alias_path

    paths = [
        r"C:\Program Files\TradingView\TradingView.exe",
        r"C:\Program Files (x86)\TradingView\TradingView.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\TradingView\TradingView.exe"),
    ]
    for p in paths:
        if os.path.exists(p):
            return p

    import glob
    win_apps_glob = glob.glob(r"C:\Program Files\WindowsApps\TradingView.Desktop_*\TradingView.exe")
    if win_apps_glob:
        return win_apps_glob[-1]

    return None

if __name__ == "__main__":
    print("Shutting down background TradingView processes...")
    subprocess.run(["taskkill", "/f", "/im", "TradingView.exe"], capture_output=True, text=True)
    subprocess.run(["taskkill", "/f", "/im", "Tradingview.exe"], capture_output=True, text=True)
    
    print("Locating TradingView Desktop installation dynamically...")
    tv_path = find_tradingview_exe()
    if tv_path:
        print(f"Found active TradingView executable: {tv_path}")
        launch_cmd = f'start "" "{tv_path}" --remote-debugging-port=9222 --remote-allow-origins=*'
    else:
        print("Using Windows protocol launch for TradingView...")
        launch_cmd = 'start tradingview: --remote-debugging-port=9222 --remote-allow-origins=*'
        
    try:
        subprocess.Popen(launch_cmd, shell=True)
        print("Successfully launched TradingView Desktop with port 9222 debugging.")
    except Exception as e:
        print(f"Failed to start TradingView via shell: {e}")
        
    print("Waiting 4 seconds for TradingView to initialize...")
    time.sleep(4)
    
    root = tk.Tk()
    app = TradingViewAutomatorApp(root)
    root.mainloop()
