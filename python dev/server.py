"""
CAL LEDGER - Python SQLite Server Backend & REST API
Provides persistent SQLite storage for customers & transactions.
Serves the web application directly to PC and Mobile devices on local Wi-Fi.
"""

import http.server
import socketserver
import os
import socket
import json
import sqlite3
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "MAIN CAL"))
DB_PATH = os.path.join(BASE_DIR, "accounts.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Customers table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            old_balance REAL DEFAULT 0,
            old_balance_date TEXT,
            history TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        cur.execute("ALTER TABLE customers ADD COLUMN history TEXT DEFAULT '[]'")
    except Exception:
        pass
    
    # Transactions table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class LedgerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        
        # GET /api/data -> Load all customers & their transactions from SQLite
        if parsed.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            
            cur.execute("SELECT id, name, phone, old_balance, old_balance_date, history FROM customers ORDER BY created_at ASC")
            cust_rows = cur.fetchall()
            
            customers = []
            for row in cust_rows:
                cid, name, phone, old_bal, old_date, hist_raw = row
                try:
                    hist = json.loads(hist_raw) if hist_raw else []
                except Exception:
                    hist = []
                cur.execute("SELECT id, date, description, type, amount FROM transactions WHERE customer_id = ? ORDER BY rowid ASC", (cid,))
                tx_rows = cur.fetchall()
                entries = []
                for tx in tx_rows:
                    entries.append({
                        "id": tx[0],
                        "date": tx[1],
                        "description": tx[2],
                        "type": tx[3],
                        "amount": float(tx[4])
                    })
                customers.append({
                    "id": cid,
                    "name": name,
                    "phone": phone or "",
                    "oldBalance": float(old_bal or 0),
                    "oldBalanceDate": old_date or "",
                    "history": hist,
                    "entries": entries
                })
                
            conn.close()
            self.wfile.write(json.dumps({"customers": customers}).encode("utf-8"))
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        
        # POST /api/save -> Save all customers & transactions into SQLite
        if parsed.path == "/api/save":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body)
            customers = payload.get("customers", [])
            
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            
            # Atomic update
            cur.execute("DELETE FROM transactions")
            cur.execute("DELETE FROM customers")
            
            for c in customers:
                hist_str = json.dumps(c.get("history", []))
                cur.execute("""
                    INSERT INTO customers (id, name, phone, old_balance, old_balance_date, history)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (c["id"], c["name"], c.get("phone", ""), float(c.get("oldBalance", 0)), c.get("oldBalanceDate", ""), hist_str))
                
                for e in c.get("entries", []):
                    cur.execute("""
                        INSERT INTO transactions (id, customer_id, date, description, type, amount)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (e["id"], c["id"], e["date"], e["description"], e["type"], float(e["amount"])))
                    
            conn.commit()
            conn.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "count": len(customers)}).encode("utf-8"))
            return

        self.send_error(404, "Not Found")

    def end_headers(self):
        # Disable browser caching of HTML, CSS, JS files
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def run_server():
    init_db()
    local_ip = get_local_ip()
    print("=" * 60)
    print("[*] CAL LEDGER SERVER RUNNING (SQLite Backend)")
    print("=" * 60)
    print(f"[*] PC browser:     http://localhost:{PORT}")
    print(f"[*] Mobile browser: http://{local_ip}:{PORT}")
    print("-" * 60)
    print("[+] Static directory: 'MAIN CAL'")
    print("[+] SQLite Database:  'python dev/ledger.db'")
    print("=" * 60)
    
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), LedgerHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
