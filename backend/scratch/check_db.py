import sqlite3
import os

db_path = r'c:\Users\Lol\Documents\Ship of thesis\Optima\backend\optima.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    tables = ['datasets', 'forecast_runs', 'bundler_runs', 'bundler_results']
    for table in tables:
        print(f"\n--- {table} ---")
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        for col in columns:
            print(col)
    conn.close()
else:
    print(f"Database not found at {db_path}")
