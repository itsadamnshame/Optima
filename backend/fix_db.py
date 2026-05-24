import sqlite3
import datetime

conn = sqlite3.connect('optima.db')
cursor = conn.cursor()

tables = [
    ('audit_logs', 'timestamp'),
    ('session_logs', 'login_time'),
    ('session_logs', 'logout_time'),
    ('session_logs', 'force_end_at'),
    ('datasets', 'upload_date'),
    ('datasets', 'last_edited_at'),
    ('forecast_runs', 'created_at'),
    ('bundler_runs', 'created_at')
]

for table, col in tables:
    try:
        cursor.execute(f"UPDATE {table} SET {col} = {col} || 'Z' WHERE {col} IS NOT NULL AND {col} NOT LIKE '%Z' AND {col} NOT LIKE '%+%'")
    except Exception as e:
        print(f'Error updating {table}.{col}: {e}')

conn.commit()
conn.close()
print('Database UTC timestamps fixed.')
