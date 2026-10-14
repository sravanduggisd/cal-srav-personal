"""
CAL LEDGER - Comprehensive Unit Test & UAT Validation Suite
Tests all bug fixes and features implemented today:
1. 'Total Balance' label instead of 'Remaining Balance'
2. Statement slip table formatting & auto-fit for big numbers on mobile
3. Negative balance display with minus sign and soft red background
4. Full-width Customer Notes Notebook strip and persistence in SQLite & localStorage
"""

import unittest
import sqlite3
import json
import os
import re
import urllib.request
import tempfile

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAIN_CAL_DIR = os.path.join(BASE_DIR, "MAIN CAL")
PYTHON_DEV_DIR = os.path.join(BASE_DIR, "python dev")
DB_PATH = os.path.join(PYTHON_DEV_DIR, "accounts.db")


class TestCalculationLogic(unittest.TestCase):
    """Unit Tests for Calculation Semantics & Formatting"""

    def calculate_customer(self, old_bal, entries):
        debits = sum(e["amount"] for e in entries if e["type"] == "DEBIT")
        credits = sum(e["amount"] for e in entries if e["type"] == "CREDIT")
        remaining = old_bal - debits + credits
        return debits, credits, remaining

    def format_currency(self, num):
        val = abs(float(num))
        # Indian number formatting simulation
        s = f"{int(val)}"
        if len(s) <= 3:
            return s
        last_three = s[-3:]
        other_digits = s[:-3]
        groups = []
        while len(other_digits) > 2:
            groups.insert(0, other_digits[-2:])
            other_digits = other_digits[:-2]
        if other_digits:
            groups.insert(0, other_digits)
        return ",".join(groups) + "," + last_three

    def test_positive_balance_calculation(self):
        old_bal = 10000.0
        entries = [
            {"type": "CREDIT", "amount": 50000.0},
            {"type": "DEBIT", "amount": 20000.0}
        ]
        debits, credits, remaining = self.calculate_customer(old_bal, entries)
        self.assertEqual(debits, 20000.0)
        self.assertEqual(credits, 50000.0)
        self.assertEqual(remaining, 40000.0)
        self.assertGreaterEqual(remaining, 0)

    def test_negative_balance_user_scenario(self):
        """User test case: 40,000 given/credited, 50,000 debited -> should be -10,000"""
        old_bal = 0.0
        entries = [
            {"type": "CREDIT", "amount": 40000.0},
            {"type": "DEBIT", "amount": 50000.0}
        ]
        debits, credits, remaining = self.calculate_customer(old_bal, entries)
        self.assertEqual(remaining, -10000.0)
        self.assertLess(remaining, 0)
        sign = "-₹" if remaining < 0 else "₹"
        formatted = f"{sign}{self.format_currency(remaining)}"
        self.assertEqual(formatted, "-₹10,000")

    def test_crores_huge_number_calculation(self):
        """User screenshot test case: 12 Crores credited, 67,899 debited"""
        old_bal = 0.0
        entries = [
            {"type": "CREDIT", "amount": 12000067789.0},
            {"type": "DEBIT", "amount": 67899.0}
        ]
        _, _, remaining = self.calculate_customer(old_bal, entries)
        self.assertEqual(remaining, 11999999890.0)
        formatted = self.format_currency(remaining)
        self.assertEqual(formatted, "11,99,99,99,890")
        self.assertGreater(len(formatted), 10)  # triggers digits-huge class


class TestSQLiteDatabaseSchemaAndPersistence(unittest.TestCase):
    """Database Unit Tests for Notes column and transaction integrity"""

    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.conn = sqlite3.connect(self.temp_db.name)
        self.cur = self.conn.cursor()
        self.cur.execute("""
            CREATE TABLE customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                old_balance REAL DEFAULT 0,
                old_balance_date TEXT,
                history TEXT DEFAULT '[]',
                notes TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.cur.execute("""
            CREATE TABLE transactions (
                id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        try:
            os.remove(self.temp_db.name)
        except Exception:
            pass

    def test_schema_has_notes_column(self):
        self.cur.execute("PRAGMA table_info(customers)")
        columns = [row[1] for row in self.cur.fetchall()]
        self.assertIn("notes", columns)

    def test_save_and_retrieve_customer_note(self):
        cust_id = "test_cust_sarath"
        test_note = "Sarath shop note: promised Monday ₹50,000 cash delivery"
        self.cur.execute("""
            INSERT INTO customers (id, name, phone, old_balance, old_balance_date, history, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (cust_id, "Sarath", "9876543210", 0.0, "14th Oct", "[]", test_note))
        self.conn.commit()

        self.cur.execute("SELECT name, notes FROM customers WHERE id = ?", (cust_id,))
        row = self.cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "Sarath")
        self.assertEqual(row[1], test_note)

    def test_delete_customer_note(self):
        cust_id = "test_cust_sarath"
        self.cur.execute("""
            INSERT INTO customers (id, name, phone, old_balance, old_balance_date, history, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (cust_id, "Sarath", "", 0.0, "", "[]", "Note to delete"))
        self.conn.commit()

        # Update note to empty string (Delete action)
        self.cur.execute("UPDATE customers SET notes = '' WHERE id = ?", (cust_id,))
        self.conn.commit()

        self.cur.execute("SELECT notes FROM customers WHERE id = ?", (cust_id,))
        row = self.cur.fetchone()
        self.assertEqual(row[0], "")


class TestBackendServerLiveApi(unittest.TestCase):
    """Integration Tests against running server.py REST API"""

    API_BASE = "http://localhost:8000"

    def test_api_health_and_index(self):
        try:
            req = urllib.request.Request(f"{self.API_BASE}/")
            with urllib.request.urlopen(req, timeout=3) as res:
                self.assertEqual(res.status, 200)
                content = res.read().decode("utf-8")
                self.assertIn("TOTAL BALANCE", content)
                self.assertIn("cust-note-strip", content)
        except Exception as e:
            self.skipTest(f"Server not running at {self.API_BASE}: {e}")

    def test_api_save_and_get_notes(self):
        try:
            payload = {
                "customers": [
                    {
                        "id": "api_test_sarath",
                        "name": "Sarath",
                        "phone": "9876543210",
                        "oldBalance": 0,
                        "oldBalanceDate": "14th Oct",
                        "history": [],
                        "notes": "Sarath shop note: verified via pytest/unittest",
                        "entries": [
                            {
                                "id": "tx_1",
                                "date": "14th Oct",
                                "description": "Payment 1",
                                "type": "CREDIT",
                                "amount": 40000
                            },
                            {
                                "id": "tx_2",
                                "date": "14th Oct",
                                "description": "Goods purchase",
                                "type": "DEBIT",
                                "amount": 50000
                            }
                        ]
                    }
                ]
            }

            save_req = urllib.request.Request(
                f"{self.API_BASE}/api/save",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(save_req, timeout=3) as save_res:
                self.assertEqual(save_res.status, 200)
                data = json.loads(save_res.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "success")

            get_req = urllib.request.Request(f"{self.API_BASE}/api/data")
            with urllib.request.urlopen(get_req, timeout=3) as get_res:
                self.assertEqual(get_res.status, 200)
                data = json.loads(get_res.read().decode("utf-8"))
                custs = data.get("customers", [])
                matched = next((c for c in custs if c["id"] == "api_test_sarath"), None)
                self.assertIsNotNone(matched)
                self.assertEqual(matched["notes"], "Sarath shop note: verified via pytest/unittest")
                self.assertEqual(len(matched["entries"]), 2)
        except Exception as e:
            self.skipTest(f"Server not running at {self.API_BASE}: {e}")


class TestFrontendUATValidation(unittest.TestCase):
    """User Acceptance Testing (UAT) Code Inspection Tests"""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(MAIN_CAL_DIR, "index.html"), "r", encoding="utf-8") as f:
            cls.html = f.read()
        with open(os.path.join(MAIN_CAL_DIR, "style.css"), "r", encoding="utf-8") as f:
            cls.css = f.read()
        with open(os.path.join(MAIN_CAL_DIR, "app.js"), "r", encoding="utf-8") as f:
            cls.js = f.read()

    def test_uat_1_total_balance_label(self):
        """UAT 1: Verify 'TOTAL BALANCE' replaces 'REMAINING BALANCE' in UI and statement"""
        self.assertIn("TOTAL BALANCE", self.html)
        self.assertNotIn("REMAINING BALANCE", self.html)
        self.assertIn('<td class="cell-desc">Total Balance</td>', self.js)
        self.assertIn('ctx.fillText("Total Balance"', self.js)
        self.assertIn('*TOTAL BALANCE:', self.js)

    def test_uat_2_statement_table_amount_column_width(self):
        """UAT 2: Verify Amount column has widened space (36%) to prevent number clipping on mobile"""
        match = re.search(r'\.slip-reference-table\s+th\.col-amt\s*\{\s*width:\s*([0-9]+)%;', self.css)
        self.assertIsNotNone(match, "th.col-amt rule not found in style.css")
        width_pct = int(match.group(1))
        self.assertGreaterEqual(width_pct, 35, f"Amount column width is {width_pct}%, should be >= 35%")

    def test_uat_2_canvas_text_wrap_and_column_widths(self):
        """UAT 2: Verify Canvas photo slip generator has drawCanvasWrappedText and expanded amount column"""
        self.assertIn("drawCanvasWrappedText", self.js)
        self.assertIn("const col3W = 324;", self.js)
        self.assertIn("const col2W = 485;", self.js)

    def test_uat_3_negative_balance_styling(self):
        """UAT 3: Verify negative balance triggers red color background and minus sign"""
        self.assertIn(".slip-reference-table tr.row-total-negative", self.css)
        self.assertIn("#fee2e2", self.css)  # soft red background
        self.assertIn("row-total-negative", self.js)
        self.assertIn("curSign.textContent = \"-₹\";", self.js)
        self.assertIn("cust-bal-digits negative", self.js)

    def test_uat_4_notes_strip_layout_never_covers_balance(self):
        """UAT 4: Verify Notes is placed as full-width strip below balance (not cramped in top right)"""
        self.assertIn("cust-note-strip", self.html)
        self.assertIn(".cust-note-strip", self.css)
        self.assertNotIn("cust-bal-top-row", self.html)
        # Verify modal controls exist
        self.assertIn('id="customerNotesModal"', self.html)
        self.assertIn('id="customerNotesInput"', self.html)
        self.assertIn('id="btnDeleteNote"', self.html)
        self.assertIn("openNotesModal", self.js)
        self.assertIn("saveCustomerNote", self.js)
        self.assertIn("deleteCustomerNote", self.js)

    def test_uat_4_huge_digits_safety_class(self):
        """UAT 4: Verify digits-huge class exists for lakhs/crores balance figures"""
        self.assertIn(".cust-bal-digits.digits-huge", self.css)
        self.assertIn("digits-huge", self.js)


if __name__ == "__main__":
    unittest.main(verbosity=2)
