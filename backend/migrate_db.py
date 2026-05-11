import sqlite3
import os

db_path = r'c:\Users\Lol\Documents\Ship of thesis\Optima\backend\optima.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # SQLite doesn't support changing column types easily. 
    # We need to recreate the table or just add a new column.
    # But since the user wants to REPLACE OrderID logic with CustomerID, 
    # we can just add CustomerID and update the code to use it.
    
    try:
        cursor.execute("ALTER TABLE sales_transactions ADD COLUMN CustomerID TEXT")
        print("Added CustomerID column to sales_transactions")
    except sqlite3.OperationalError:
        print("CustomerID column already exists")
        
    conn.commit()
    conn.close()
else:
    print(f"Database not found at {db_path}")
