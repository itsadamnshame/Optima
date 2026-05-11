import sqlite3
import os

db_path = r'c:\Users\Lol\Documents\Ship of thesis\Optima\backend\optima.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(sales_transactions)")
    columns = cursor.fetchall()
    for col in columns:
        print(col)
    conn.close()
else:
    print(f"Database not found at {db_path}")
