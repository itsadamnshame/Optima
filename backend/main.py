import asyncio
import pandas as pd
import io
import traceback
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends, Header
from pydantic import BaseModel
import jwt
import datetime
import bcrypt
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, inspect, text
import holidays as ph_holidays_lib

# ==========================================
# CUSTOM MODULE IMPORTS
# ==========================================
from src.quantitative.hybrid_forecaster import preprocess_and_forecast_item
from src.qualitative.bundle_analyzer import create_cart_matrix, generate_bundle_rules, analyze_custom_bundle
from src.decision.rule_engine import generate_categorized_recommendations

app = FastAPI(title="OPTIMA Engine API - Unified Calendar Build")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./optima.db"
engine = create_engine(DATABASE_URL)

# --- DATABASE INITIALIZATION & SEEDING ---
@app.on_event("startup")
def setup_db():
    """Ensure table exists and pre-fill with PH holidays if empty."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS custom_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_name TEXT NOT NULL,
                event_date TEXT NOT NULL UNIQUE
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                username TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL,
                role TEXT NOT NULL,
                login_time TEXT NOT NULL,
                logout_time TEXT,
                force_end_at TEXT
            )
        """))
        conn.commit()

        # SCHEMA MIGRATION: add login_locked_until to users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN login_locked_until TEXT"))
            conn.commit()
        except Exception:
            pass  # column already exists
        
        # SCHEMA MIGRATION: ADD NEW COLUMNS IF THEY DON'T EXIST
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN email TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN phone_number TEXT"))
        except Exception:
            pass # Columns likely already exist
            
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN first_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN last_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN middle_name TEXT"))
            conn.commit()
            print("OPTIMA: users table schema upgraded with split names.")
        except Exception:
            pass
        
        
        # CHECK IF ADMIN EXISTS
        admin_exists = conn.execute(text("SELECT COUNT(*) FROM users WHERE username='admin'")).fetchone()[0]
        if admin_exists == 0:
            print("OPTIMA: Seeding default admin account...")
            admin_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute(
                text("INSERT INTO users (username, password_hash, role, status) VALUES (:u, :p, :r, :s)"),
                {"u": "admin", "p": admin_hash, "r": "ADMIN", "s": "approved"}
            )
            conn.commit()

        # CHECK IF WE NEED TO SEED THE CALENDAR
        res = conn.execute(text("SELECT COUNT(*) FROM custom_events")).fetchone()
        if res[0] == 0:
            print("OPTIMA: Seeding database with official PH Holidays...")
            # We seed 2026 and 2027
            ph_holidays = ph_holidays_lib.Philippines(years=[2026, 2027])
            
            for date, name in ph_holidays.items():
                try:
                    conn.execute(
                        text("INSERT INTO custom_events (event_name, event_date) VALUES (:name, :date)"),
                        {"name": name, "date": date.strftime('%Y-%m-%d')}
                    )
                except:
                    pass # Skip any accidental duplicates
            conn.commit()
            print("OPTIMA: Seeding complete.")

# ==========================================
# AUTHENTICATION HELPERS & LOGGING
# ==========================================
SECRET_KEY = "optima_secret_thesis_key"

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

def log_audit(conn, username: str, action: str, details: str):
    try:
        timestamp = datetime.datetime.utcnow().isoformat()
        conn.execute(
            text("INSERT INTO audit_logs (timestamp, username, action, details) VALUES (:t, :u, :a, :d)"),
            {"t": timestamp, "u": username, "a": action, "d": details}
        )
    except Exception as e:
        print("Audit logging failed:", e)

# ==========================================
# SPECIAL DAYS MANAGER ENDPOINTS
# ==========================================
@app.get("/api/get-events")
async def get_custom_events():
    try:
        with engine.connect() as conn:
            # We sort by date so the UI list is chronological
            res = conn.execute(text("SELECT event_name, event_date FROM custom_events ORDER BY event_date ASC")).fetchall()
            return {"events": [{"name": r[0], "date": r[1]} for r in res]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/add-event")
async def add_custom_event(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(
                text("INSERT INTO custom_events (event_name, event_date) VALUES (:name, :date)"),
                {"name": data['name'], "date": data['date']}
            )
            conn.commit()
            log_audit(conn, user['username'], "ADD_EVENT", f"Added {data['name']} on {data['date']}")
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=400, detail="An event already exists on this date.")

@app.delete("/api/delete-event/{event_date}")
async def delete_custom_event(event_date: str, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(
                text("DELETE FROM custom_events WHERE event_date = :date"),
                {"date": event_date}
            )
            conn.commit()
            log_audit(conn, user['username'], "DELETE_EVENT", f"Deleted event on {event_date}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PRODUCT SELECTOR ENDPOINT
# ==========================================
@app.get("/api/get-items")
async def get_all_items():
    try:
        inspector = inspect(engine)
        if not inspector.has_table("sales_transactions"):
            return {"items": []}
        raw_df = pd.read_sql("SELECT DISTINCT item_description FROM sales_transactions", engine)
        return {"items": sorted(raw_df['item_description'].tolist())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# AUTHENTICATION & RBAC ENDPOINTS
# ==========================================
class RegisterModel(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str
    middle_name: str = ""
    email: str = ""
    phone_number: str = ""

class LoginModel(BaseModel):
    username: str
    password: str

class AdminActionModel(BaseModel):
    username: str

@app.post("/api/auth/register")
async def register_user(data: RegisterModel):
    try:
        with engine.connect() as conn:
            user_exists = conn.execute(text("SELECT * FROM users WHERE username=:u"), {"u": data.username}).fetchone()
            if user_exists:
                raise HTTPException(status_code=400, detail="Username already exists")
            
            pwd_hash = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute(
                text("""INSERT INTO users (username, password_hash, role, status, first_name, last_name, middle_name, email, phone_number) 
                        VALUES (:u, :p, 'USER', 'under_review', :fn, :ln, :mn, :e, :pn)"""),
                {
                    "u": data.username, "p": pwd_hash, 
                    "fn": data.first_name, "ln": data.last_name, "mn": data.middle_name,
                    "e": data.email, "pn": data.phone_number
                }
            )
            conn.commit()
        return {"status": "success", "message": "Account created. Please wait for admin approval."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login")
async def login_user(data: LoginModel):
    try:
        with engine.connect() as conn:
            user = conn.execute(text("SELECT * FROM users WHERE username=:u"), {"u": data.username}).fetchone()
            if not user or not bcrypt.checkpw(data.password.encode('utf-8'), user[2].encode('utf-8')): # index 2 is password_hash
                raise HTTPException(status_code=401, detail="Invalid credentials")
            
            if user[4] == 'under_review': # index 4 is status
                raise HTTPException(status_code=403, detail="Account is pending admin approval")
            elif user[4] == 'denied':
                raise HTTPException(status_code=403, detail="Account registration was denied")

            # Check login lock (set by admin force-end)
            locked_until_raw = conn.execute(
                text("SELECT login_locked_until FROM users WHERE username=:u"), {"u": data.username}
            ).fetchone()
            if locked_until_raw and locked_until_raw[0]:
                lock_dt = datetime.datetime.fromisoformat(locked_until_raw[0])
                now = datetime.datetime.utcnow()
                if now < lock_dt:
                    remaining = int((lock_dt - now).total_seconds() // 60) + 1
                    raise HTTPException(
                        status_code=403,
                        detail=f"Account login is locked by an administrator. Try again in {remaining} minute(s)."
                    )
                
            import uuid
            session_id = str(uuid.uuid4())
            login_time = datetime.datetime.utcnow().isoformat()

            token = jwt.encode({
                "username": user[1],
                "role": user[3],
                "session_id": session_id,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            }, SECRET_KEY, algorithm="HS256")
            
            conn.execute(
                text("INSERT INTO session_logs (session_id, username, role, login_time) VALUES (:sid, :u, :r, :lt)"),
                {"sid": session_id, "u": user[1], "r": user[3], "lt": login_time}
            )
            log_audit(conn, user[1], "LOGIN", "User logged in successfully")
            conn.commit()
            
            return {"status": "success", "token": token, "role": user[3], "username": user[1], "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/logout")
async def logout_user(user=Depends(get_current_user)):
    """Records the logout time for this session in session_logs."""
    try:
        session_id = user.get("session_id")
        logout_time = datetime.datetime.utcnow().isoformat()
        with engine.connect() as conn:
            if session_id:
                conn.execute(
                    text("UPDATE session_logs SET logout_time = :lt WHERE session_id = :sid"),
                    {"lt": logout_time, "sid": session_id}
                )
            log_audit(conn, user["username"], "LOGOUT", "User logged out")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/session-logs")
async def get_session_logs(user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            res = conn.execute(text(
                "SELECT id, session_id, username, role, login_time, logout_time, force_end_at FROM session_logs ORDER BY id DESC LIMIT 100"
            )).fetchall()
            logs = []
            for r in res:
                login_dt = datetime.datetime.fromisoformat(r[4])
                logout_dt = datetime.datetime.fromisoformat(r[5]) if r[5] else None
                duration = None
                if logout_dt:
                    secs = int((logout_dt - login_dt).total_seconds())
                    duration = f"{secs // 3600}h {(secs % 3600) // 60}m {secs % 60}s"
                logs.append({
                    "id": r[0],
                    "session_id": r[1],
                    "username": r[2],
                    "role": r[3],
                    "login_time": r[4],
                    "logout_time": r[5],
                    "force_end_at": r[6],
                    "duration": duration
                })
            return {"sessions": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/session-status")
async def get_session_status(user=Depends(get_current_user)):
    """Polled by the frontend to check if this session has been force-ended."""
    session_id = user.get("session_id")
    if not session_id:
        return {"status": "active"}
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT logout_time FROM session_logs WHERE session_id = :sid"),
                {"sid": session_id}
            ).fetchone()
        if not row or row[0]:
            return {"status": "terminated"}
        return {"status": "active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ForceEndModel(BaseModel):
    session_id: str

@app.post("/api/admin/force-end-session")
async def force_end_session(data: ForceEndModel, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        now = datetime.datetime.utcnow()
        locked_until = (now + datetime.timedelta(minutes=10)).isoformat()
        with engine.connect() as conn:
            # Immediately terminate the session
            result = conn.execute(
                text("UPDATE session_logs SET logout_time = :lt WHERE session_id = :sid AND logout_time IS NULL"),
                {"lt": now.isoformat(), "sid": data.session_id}
            )
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Active session not found")
            # Get the target username
            row = conn.execute(
                text("SELECT username FROM session_logs WHERE session_id = :sid"),
                {"sid": data.session_id}
            ).fetchone()
            target_user = row[0] if row else "unknown"
            # Lock login for 10 minutes
            conn.execute(
                text("UPDATE users SET login_locked_until = :lu WHERE username = :u"),
                {"lu": locked_until, "u": target_user}
            )
            log_audit(conn, user["username"], "FORCE_END_SESSION",
                      f"Force-ended {target_user}'s session. Login locked until {locked_until} UTC.")
            conn.commit()
        return {"status": "success", "locked_until": locked_until}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/pending-users")
async def get_pending_users(user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT username, status FROM users WHERE status='under_review' AND role='USER'")).fetchall()
            return {"users": [{"username": r[0], "status": r[1]} for r in res]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/approve")
async def approve_user(data: AdminActionModel, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET status='approved' WHERE username=:u"), {"u": data.username})
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/deny")
async def deny_user(data: AdminActionModel, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET status='denied' WHERE username=:u"), {"u": data.username})
            log_audit(conn, user['username'], "DENY_USER", f"Denied registration for {data.username}")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/audit-logs")
async def get_audit_logs(user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT timestamp, username, action, details FROM audit_logs ORDER BY id DESC LIMIT 100")).fetchall()
            logs = [{"timestamp": r[0], "username": r[1], "action": r[2], "details": r[3]} for r in res]
            return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# DATA INGESTION
# ==========================================
@app.post("/api/upload-data")
async def process_sales_data(file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required to upload data")
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents)) if file.filename.endswith('.xlsx') else pd.read_csv(io.BytesIO(contents))
        
        df.columns = (df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace(r'\(|\)', '', regex=True))
        df = df.rename(columns={'orderdate': 'order_date', 'itemdescription': 'item_description', 'customerid': 'customer_id', 'orderid': 'order_id'})
        
        df['order_date'] = pd.to_datetime(df['order_date'], dayfirst=True, errors='coerce')
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
        
        valid_sales = df.dropna(subset=['item_description', 'order_id', 'order_date']).copy()
        valid_sales.to_sql("sales_transactions", engine, if_exists="replace", index=False)
        
        with engine.connect() as conn:
            log_audit(conn, user['username'], "UPLOAD_DATA", f"Uploaded {len(valid_sales)} rows from {file.filename}")
            conn.commit()
            
        return {"status": "success", "total_rows": len(valid_sales)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# CUSTOM BUNDLE ANALYSIS
# ==========================================
class BundleAnalysisRequest(BaseModel):
    items: list

@app.get("/api/get-items")
async def get_all_items(user=Depends(get_current_user)):
    try:
        inspector = inspect(engine)
        if not inspector.has_table("sales_transactions"):
            return {"items": []}
        
        raw_df = pd.read_sql("SELECT DISTINCT item_description FROM sales_transactions ORDER BY item_description", engine)
        return {"items": raw_df['item_description'].tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-bundle")
async def handle_custom_bundle_analysis(data: BundleAnalysisRequest, user=Depends(get_current_user)):
    try:
        inspector = inspect(engine)
        if not inspector.has_table("sales_transactions"):
            raise HTTPException(status_code=400, detail="Please upload sales data first.")

        raw_df = pd.read_sql("SELECT * FROM sales_transactions", engine)
        cart_matrix = create_cart_matrix(raw_df)
        
        results = analyze_custom_bundle(cart_matrix, data.items, raw_df)
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
            
        return {"status": "success", "results": results}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/generate-recommendations")
async def trigger_optima_pipeline(
    end_date: str = Query(...),
    mode: str = Query("top"),
    top_n: int = Query(5),
    selected_items: str = Query(None),
    user=Depends(get_current_user)
):
    try:
        inspector = inspect(engine)
        if not inspector.has_table("sales_transactions"):
            raise HTTPException(status_code=400, detail="Please upload sales data first.")

        raw_df = pd.read_sql("SELECT * FROM sales_transactions", engine)
        
        if mode == "manual" and selected_items:
            items_to_forecast = [i.strip() for i in selected_items.split(',')]
        else:
            items_to_forecast = raw_df['item_description'].value_counts().head(top_n).index.tolist()

        performance_metrics = {}

        def run_quantitative_branch():
            all_forecasts = []
            for item in items_to_forecast:
                item_df = raw_df[raw_df['item_description'] == item].copy()
                forecast = preprocess_and_forecast_item(item_df, end_date)
                
                if not forecast.empty:
                    forecast['item_description'] = item
                    all_forecasts.append(forecast)
                    if hasattr(forecast, 'attrs') and 'metrics' in forecast.attrs:
                        performance_metrics[item] = forecast.attrs['metrics']
            
            return pd.concat(all_forecasts, ignore_index=True) if all_forecasts else pd.DataFrame()

        def run_qualitative_branch():
            cart_matrix = create_cart_matrix(raw_df)
            return generate_bundle_rules(cart_matrix, raw_df, min_support=0.001)

        forecast_df, rules_df = await asyncio.gather(
            asyncio.to_thread(run_quantitative_branch),
            asyncio.to_thread(run_qualitative_branch)
        )

        final_advice = generate_categorized_recommendations(forecast_df, rules_df)
        print("DEBUG RECS:", final_advice)
        
        return {
            "status": "success",
            "recommendations": final_advice,
            "bundles": json.loads(rules_df.to_json(orient="records")),
            "chart_data": json.loads(forecast_df.to_json(orient="records")),
            "performance_metrics": performance_metrics
        }
        
        with engine.connect() as conn:
            log_audit(conn, user['username'], "GENERATE_FORECAST", f"Forecasted {len(items_to_forecast)} items up to {end_date}")
            conn.commit()
            
        return res_data
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)