import asyncio
import numpy as np
import pandas as pd
import io
import traceback
import json
from typing import List, Optional, Union
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends, Header, Form, Body
from pydantic import BaseModel
import jwt
import datetime
import re
import bcrypt
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import bindparam, create_engine, inspect, text
import holidays as ph_holidays_lib
import logging
import os

# ==========================================
# CUSTOM MODULE IMPORTS
# ==========================================
from src.quantitative.hybrid_forecaster import preprocess_and_forecast_item
from src.qualitative.bundle_analyzer import (
    create_cart_matrix, 
    generate_bundle_rules, 
    analyze_custom_bundle,
    generate_strategic_bundles,
    score_single_pair
)

app = FastAPI(title="OPTIMA Engine API - Unified Calendar Build")

# --- SILENCE POLLING LOGS ---
class PollingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/auth/session-status" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(PollingFilter())

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./optima.db")
IS_POSTGRES = DATABASE_URL.lower().startswith(("postgresql", "postgres"))
engine_kwargs = {"pool_pre_ping": True}
if IS_POSTGRES:
    engine_kwargs["isolation_level"] = "AUTOCOMMIT"
engine = create_engine(DATABASE_URL, **engine_kwargs)

def _csv_origins(value: str):
    return [origin.strip() for origin in value.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_csv_origins(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")),
    allow_methods=["*"],
    allow_headers=["*"],
)

def _insert_and_get_id(conn, sql: str, params: dict):
    """Insert a row and return its id on both SQLite and PostgreSQL."""
    statement = sql
    if IS_POSTGRES and "returning" not in sql.lower():
        statement = f"{sql} RETURNING id"
    result = conn.execute(text(statement), params)
    if IS_POSTGRES:
        return result.scalar_one()
    return result.lastrowid

def _read_sql(sql: str, params: Optional[dict] = None):
    return pd.read_sql(text(sql), engine, params=params)

def _read_sql_in(sql: str, param_name: str, values: List[int], **kwargs):
    stmt = text(sql).bindparams(bindparam(param_name, expanding=True))
    params = {param_name: values, **kwargs}
    return pd.read_sql(stmt, engine, params=params)

def _parse_id_csv(value: str) -> List[int]:
    try:
        return [int(v.strip()) for v in value.split(",") if v.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Dataset IDs must be comma-separated integers")

def _ident(column: str) -> str:
    return f'"{column}"' if IS_POSTGRES else column

def _agg_item_select() -> str:
    return 'itemdescription AS "ItemDescription"' if IS_POSTGRES else "ItemDescription"

def _year_expr(column: str) -> str:
    if IS_POSTGRES:
        return f"TO_CHAR({_ident(column)}::timestamp, 'YYYY')"
    return f"strftime('%Y', {column})"

def _ignore_schema_error(conn):
    if not IS_POSTGRES:
        return
    try:
        conn.rollback()
    except Exception:
        pass

# ==========================================
# QUALITATIVE CACHE (Apriori + RF results)
# ==========================================
_qualitative_cache = {
    "dataset_id": None,
    "rules_df": None
}
cancelled_runs = set()

def _get_active_dataset_id():
    """Returns the currently active dataset_id, or None."""
    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT id FROM datasets WHERE is_active = 1 LIMIT 1")).fetchone()
            return row[0] if row else None
    except:
        return None

def _get_active_dataset_df():
    """Returns a DataFrame of transactions for the active dataset only."""
    active_id = _get_active_dataset_id()
    if active_id is None:
        raise HTTPException(status_code=400, detail="No active dataset selected. Please select a dataset from the sidebar.")
    return _read_sql("SELECT * FROM sales_transactions WHERE dataset_id = :dataset_id", {"dataset_id": active_id}), active_id

# --- DATABASE INITIALIZATION & SEEDING ---
@app.on_event("startup")
def setup_db():
    """Ensure table exists and pre-fill with PH holidays if empty."""
    pk_syntax = "SERIAL PRIMARY KEY" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    
    with engine.connect() as conn:
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS users (
                id {pk_syntax},
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """))
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id {pk_syntax},
                timestamp TEXT NOT NULL,
                username TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT NOT NULL
            )
        """))
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS session_logs (
                id {pk_syntax},
                session_id TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL,
                role TEXT NOT NULL,
                login_time TEXT NOT NULL,
                logout_time TEXT,
                force_end_at TEXT
            )
        """))
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS datasets (
                id {pk_syntax},
                title TEXT NOT NULL,
                filename TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                uploader TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                is_private INTEGER DEFAULT 0,
                last_edited_at TEXT
            )
        """))
        conn.commit()

        # SCHEMA MIGRATION: add login_locked_until to users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN login_locked_until TEXT"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass  # column already exists
        
        try:
            conn.execute(text("ALTER TABLE datasets ADD COLUMN dataset_type TEXT DEFAULT 'MASTER'"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass
        
        try:
            conn.execute(text("ALTER TABLE datasets ADD COLUMN last_edited_at TEXT"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass


        try:
            conn.execute(text("ALTER TABLE datasets ADD COLUMN date_range_start TEXT"))
            conn.execute(text("ALTER TABLE datasets ADD COLUMN date_range_end TEXT"))
            conn.execute(text("ALTER TABLE datasets ADD COLUMN gap_info TEXT"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass

        # [NEW] CREATE FORECAST TABLES
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS forecast_runs (
                id {pk_syntax},
                name TEXT NOT NULL,
                dataset_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                config_json TEXT,
                status TEXT DEFAULT 'completed',
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            )
        """))
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS forecast_results (
                id {pk_syntax},
                run_id INTEGER NOT NULL,
                item_description TEXT NOT NULL,
                result_json TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES forecast_runs(id) ON DELETE CASCADE
            )
        """))
        
        # [NEW] CREATE BUNDLER TABLES
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS bundler_runs (
                id {pk_syntax},
                name TEXT NOT NULL,
                dataset_id INTEGER NOT NULL,
                forecast_run_id INTEGER,
                created_at TEXT NOT NULL,
                status TEXT DEFAULT 'completed',
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
                FOREIGN KEY (forecast_run_id) REFERENCES forecast_runs(id) ON DELETE SET NULL
            )
        """))
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS bundler_results (
                id {pk_syntax},
                run_id INTEGER NOT NULL,
                bundle_pair TEXT NOT NULL,
                result_json TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES bundler_runs(id) ON DELETE CASCADE
            )
        """))
        conn.commit()

        # SCHEMA MIGRATION: ADD NEW COLUMNS IF THEY DON'T EXIST
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN email TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN phone_number TEXT"))
        except Exception:
            _ignore_schema_error(conn)
            pass # Columns likely already exist
            
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN first_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN last_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN middle_name TEXT"))
            conn.commit()
            print("OPTIMA: users table schema upgraded with split names.")
        except Exception:
            _ignore_schema_error(conn)
            pass

        # Raw uploaded rows. Pandas can create this implicitly, but declaring it
        # keeps PostgreSQL startup and old-dataset recovery paths predictable.
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sales_transactions (
                ItemDescription TEXT,
                OrderID TEXT,
                OrderDate TEXT,
                Quantity REAL,
                Total REAL,
                CustomerID TEXT,
                dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE
            )
        """))
        conn.commit()
        
        # SCHEMA MIGRATION: is_active for datasets
        try:
            conn.execute(text("ALTER TABLE datasets ADD COLUMN is_active INTEGER DEFAULT 0"))
            conn.commit()
            print("OPTIMA: datasets table upgraded with is_active column.")
        except Exception:
            _ignore_schema_error(conn)
            pass
        
        # [NEW] CREATE aggregated_sales TABLE
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS aggregated_sales (
                id {pk_syntax},
                dataset_id INTEGER NOT NULL,
                ItemDescription TEXT NOT NULL,
                ds TEXT NOT NULL,
                y REAL NOT NULL,
                metric_type TEXT DEFAULT 'Volume',
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            )
        """))
        conn.commit()

        conn.commit()

        try:
            conn.execute(text("ALTER TABLE aggregated_sales ADD COLUMN metric_type TEXT DEFAULT 'Volume'"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass

        # [NEW] Restore simplified item_metadata table
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS item_metadata (
                id {pk_syntax},
                dataset_id INTEGER NOT NULL,
                ItemDescription TEXT NOT NULL,
                is_bundle INTEGER DEFAULT 0,
                is_not_product INTEGER DEFAULT 0,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
            )
        """))
        conn.commit()

        try:
            conn.execute(text("ALTER TABLE item_metadata ADD COLUMN is_bundle INTEGER DEFAULT 0"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass

        try:
            conn.execute(text("ALTER TABLE item_metadata ADD COLUMN is_not_product INTEGER DEFAULT 0"))
            conn.commit()
        except Exception:
            _ignore_schema_error(conn)
            pass
        
        # CHECK IF ADMIN EXISTS
        admin_exists = conn.execute(text("SELECT COUNT(*) FROM users WHERE username='admin'")).fetchone()[0]
        if admin_exists == 0:
            print("OPTIMA: Seeding default admin account...")
            admin_password = os.getenv("OPTIMA_ADMIN_PASSWORD")
            if IS_POSTGRES and not admin_password:
                raise RuntimeError("OPTIMA_ADMIN_PASSWORD must be set before the first production startup")
            admin_hash = bcrypt.hashpw((admin_password or "admin123").encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute(
                text("INSERT INTO users (username, password_hash, role, status) VALUES (:u, :p, :r, :s)"),
                {"u": "admin", "p": admin_hash, "r": "ADMIN", "s": "approved"}
            )
            conn.commit()

        conn.commit()

# ==========================================
# AUTHENTICATION HELPERS & LOGGING
# ==========================================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if IS_POSTGRES:
        raise RuntimeError("SECRET_KEY must be set when using PostgreSQL/production DATABASE_URL")
    SECRET_KEY = "dev_only_optima_secret_change_me"

def get_current_user(authorization: str = Header(None, alias="Authorization")):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = payload.get("username")
        if username:
            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT role, status FROM users WHERE username = :u"),
                    {"u": username}
                ).fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Account no longer exists")
            if row[1] != "approved":
                raise HTTPException(status_code=401, detail="Account is not active")
            payload["role"] = row[0]
        return payload
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except:
        raise HTTPException(status_code=401, detail="Authentication failed")

def _validate_password(password: str):
    if not password or len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one number."
    if not re.search(r"[!@#$%^&*()_+\-=[\]{};':\"\\|,.<>/?]", password):
        return "Password must contain at least one special character."
    return None


def log_audit(conn, username: str, action: str, details: str):
    try:
        timestamp = (datetime.datetime.utcnow().isoformat() + "Z")
        conn.execute(
            text("INSERT INTO audit_logs (timestamp, username, action, details) VALUES (:t, :u, :a, :d)"),
            {"t": timestamp, "u": username, "a": action, "d": details}
        )
    except Exception as e:
        print("Audit logging failed:", e)

# --- SPECIAL DAYS MANAGER ENDPOINTS REMOVED ---

# ==========================================
# PRODUCT SELECTOR ENDPOINT
# ==========================================
# Removed redundant get-items endpoint.

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

class ProfileUpdateModel(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None

class PasswordChangeModel(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class AdminActionModel(BaseModel):
    username: str

class AccountUpdateModel(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

def _require_admin(user):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

def _terminate_user_sessions(conn, username: str, reason: str):
    now = (datetime.datetime.utcnow().isoformat() + "Z")
    conn.execute(
        text("UPDATE session_logs SET logout_time = :lt, force_end_at = :lt WHERE username = :u AND logout_time IS NULL"),
        {"lt": now, "u": username}
    )
    log_audit(conn, "system", "TERMINATE_SESSIONS", f"{reason}: active sessions ended for {username}")

@app.get("/api/auth/profile")
async def get_profile(user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT username, role, first_name, last_name, middle_name, email, phone_number FROM users WHERE username = :u"),
                {"u": user.get("username")}
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "profile": {
                    "username": row[0],
                    "role": row[1],
                    "first_name": row[2] or "",
                    "last_name": row[3] or "",
                    "middle_name": row[4] or "",
                    "email": row[5] or "",
                    "phone_number": row[6] or ""
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/auth/profile")
async def update_profile(data: ProfileUpdateModel, user=Depends(get_current_user)):
    try:
        updates = {}
        if data.first_name is not None:
            updates['first_name'] = data.first_name
        if data.last_name is not None:
            updates['last_name'] = data.last_name
        if data.middle_name is not None:
            updates['middle_name'] = data.middle_name
        if data.email is not None:
            updates['email'] = data.email
        if data.phone_number is not None:
            updates['phone_number'] = data.phone_number

        if not updates:
            return {"status": "success", "message": "No changes made"}

        with engine.connect() as conn:
            set_clause = ", ".join([f"{field} = :{field}" for field in updates.keys()])
            params = {**updates, "u": user.get("username")}
            conn.execute(text(f"UPDATE users SET {set_clause} WHERE username = :u"), params)
            conn.commit()
        return {"status": "success", "message": "Profile updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/auth/profile/password")
async def change_password(data: PasswordChangeModel, user=Depends(get_current_user)):
    try:
        if data.new_password != data.confirm_password:
            raise HTTPException(status_code=400, detail="New password and confirmation must match")
        password_error = _validate_password(data.new_password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)

        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT password_hash FROM users WHERE username = :u"),
                {"u": user.get("username")}
            ).fetchone()
            if not row or not bcrypt.checkpw(data.current_password.encode('utf-8'), row[0].encode('utf-8')):
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            new_hash = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute(
                text("UPDATE users SET password_hash = :ph WHERE username = :u"),
                {"ph": new_hash, "u": user.get("username")}
            )
            conn.commit()
        return {"status": "success", "message": "Password updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/check-username")
async def check_username(username: str):
    try:
        with engine.connect() as conn:
            # Only consider accounts that are approved or banned as "taking" the username.
            # accounts waiting for verification (under_review) or denied accounts should be available.
            user_exists = conn.execute(
                text("SELECT id FROM users WHERE username=:u AND status NOT IN ('under_review', 'denied')"), 
                {"u": username}
            ).fetchone()
            return {"exists": bool(user_exists)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/register")
async def register_user(data: RegisterModel):
    try:
        password_error = _validate_password(data.password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)

        with engine.connect() as conn:
            # Check for permanent accounts (approved or banned)
            permanent_user = conn.execute(
                text("SELECT id FROM users WHERE username=:u AND status NOT IN ('under_review', 'denied')"), 
                {"u": data.username}
            ).fetchone()
            
            if permanent_user:
                raise HTTPException(status_code=400, detail="Username already exists and is active or banned")
            
            # If an account exists but is under_review or denied, we delete it to allow the new registration
            conn.execute(
                text("DELETE FROM users WHERE username=:u AND status IN ('under_review', 'denied')"),
                {"u": data.username}
            )
            
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
            elif user[4] == 'banned':
                raise HTTPException(status_code=403, detail="Account has been banned")

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
            login_time = (datetime.datetime.utcnow().isoformat() + "Z")

            token = jwt.encode({
                "username": user[1],
                "role": user[3],
                "session_id": session_id,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
            }, SECRET_KEY, algorithm="HS256")
            
            conn.execute(
                text("INSERT INTO session_logs (session_id, username, role, login_time) VALUES (:sid, :u, :r, :lt)"),
                {"sid": session_id, "u": user[1], "r": user[3], "lt": login_time}
            )
            log_audit(conn, user[1], "LOGIN", "User logged in successfully")
            conn.commit()
            
            return {
                "status": "success",
                "token": token,
                "role": user[3],
                "username": user[1],
                "first_name": user[5] if len(user) > 5 else "",
                "last_name": user[6] if len(user) > 6 else "",
                "session_id": session_id
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/logout")
async def logout_user(user=Depends(get_current_user)):
    """Records the logout time for this session in session_logs."""
    try:
        session_id = user.get("session_id")
        logout_time = (datetime.datetime.utcnow().isoformat() + "Z")
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
    _require_admin(user)
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

# NOTE: /api/datasets/{dataset_id}/metadata endpoint removed — item configuration no longer used

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
    _require_admin(user)
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
    _require_admin(user)
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT username, status FROM users WHERE status='under_review' AND role='USER'")).fetchall()
            return {"users": [{"username": r[0], "status": r[1]} for r in res]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/approve")
async def approve_user(data: AdminActionModel, user=Depends(get_current_user)):
    _require_admin(user)
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET status='approved' WHERE username=:u"), {"u": data.username})
            log_audit(conn, user['username'], "APPROVE_USER", f"Approved account for {data.username}")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/deny")
async def deny_user(data: AdminActionModel, user=Depends(get_current_user)):
    _require_admin(user)
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET status='denied' WHERE username=:u"), {"u": data.username})
            _terminate_user_sessions(conn, data.username, "Account denied")
            log_audit(conn, user['username'], "DENY_USER", f"Denied registration for {data.username}")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/accounts")
async def get_accounts(user=Depends(get_current_user)):
    _require_admin(user)
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT
                    u.username, u.role, u.status,
                    u.first_name, u.last_name, u.middle_name,
                    u.email, u.phone_number, u.login_locked_until,
                    COALESCE((SELECT COUNT(*) FROM session_logs s WHERE s.username = u.username), 0) AS session_count,
                    COALESCE((SELECT COUNT(*) FROM session_logs s WHERE s.username = u.username AND s.logout_time IS NULL), 0) AS active_sessions,
                    (SELECT MAX(login_time) FROM session_logs s WHERE s.username = u.username) AS last_login
                FROM users u
                ORDER BY u.role DESC, u.status ASC, u.username ASC
            """)).fetchall()
            accounts = []
            for r in rows:
                accounts.append({
                    "username": r[0],
                    "role": r[1],
                    "status": r[2],
                    "first_name": r[3] or "",
                    "last_name": r[4] or "",
                    "middle_name": r[5] or "",
                    "email": r[6] or "",
                    "phone_number": r[7] or "",
                    "login_locked_until": r[8],
                    "session_count": r[9],
                    "active_sessions": r[10],
                    "last_login": r[11],
                })
            return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/admin/accounts/{target_username}")
async def update_account(target_username: str, data: AccountUpdateModel, user=Depends(get_current_user)):
    _require_admin(user)
    valid_roles = {"ADMIN", "USER"}
    valid_statuses = {"approved", "under_review", "denied", "banned"}
    try:
        with engine.connect() as conn:
            target = conn.execute(
                text("SELECT username, role, status FROM users WHERE username = :u"),
                {"u": target_username}
            ).fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="Account not found")

            updates = {}
            changes = []
            if data.role is not None:
                role = data.role.upper()
                if role not in valid_roles:
                    raise HTTPException(status_code=400, detail="Invalid role")
                if target_username == user.get("username") and role != "ADMIN":
                    raise HTTPException(status_code=400, detail="You cannot revoke your own admin role")
                updates["role"] = role
                changes.append(f"role {target[1]} -> {role}")

            if data.status is not None:
                status = data.status.lower()
                if status not in valid_statuses:
                    raise HTTPException(status_code=400, detail="Invalid status")
                if target_username == user.get("username") and status != "approved":
                    raise HTTPException(status_code=400, detail="You cannot disable your own account")
                updates["status"] = status
                updates["login_locked_until"] = None
                changes.append(f"status {target[2]} -> {status}")

            if not updates:
                return {"status": "success", "message": "No changes made"}

            if "role" in updates and updates["role"] != "ADMIN" and target[1] == "ADMIN":
                admin_count = conn.execute(
                    text("SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND status = 'approved'")
                ).scalar()
                if admin_count <= 1:
                    raise HTTPException(status_code=400, detail="At least one approved admin must remain")

            set_clause = ", ".join([f"{key} = :{key}" for key in updates.keys()])
            conn.execute(text(f"UPDATE users SET {set_clause} WHERE username = :username"), {**updates, "username": target_username})

            if updates.get("status") in {"banned", "denied", "under_review"} or ("role" in updates and target[1] != updates["role"]):
                _terminate_user_sessions(conn, target_username, "Account permissions changed")

            log_audit(conn, user['username'], "UPDATE_ACCOUNT", f"Updated {target_username}: {', '.join(changes)}")
            conn.commit()
            return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/accounts/{target_username}/ban")
async def ban_account(target_username: str, user=Depends(get_current_user)):
    return await update_account(target_username, AccountUpdateModel(status="banned"), user)

@app.post("/api/admin/accounts/{target_username}/activate")
async def activate_account(target_username: str, user=Depends(get_current_user)):
    return await update_account(target_username, AccountUpdateModel(status="approved"), user)

@app.get("/api/auth/account-activity")
async def get_my_account_activity(user=Depends(get_current_user)):
    username = user.get("username")
    try:
        with engine.connect() as conn:
            sessions = conn.execute(text("""
                SELECT id, session_id, role, login_time, logout_time, force_end_at
                FROM session_logs
                WHERE username = :u
                ORDER BY id DESC
                LIMIT 100
            """), {"u": username}).fetchall()
            audits = conn.execute(text("""
                SELECT timestamp, username, action, details
                FROM audit_logs
                WHERE username = :u OR details LIKE :needle
                ORDER BY id DESC
                LIMIT 100
            """), {"u": username, "needle": f"%{username}%"}).fetchall()
            return {
                "sessions": [
                    {
                        "id": r[0],
                        "session_id": r[1],
                        "role": r[2],
                        "login_time": r[3],
                        "logout_time": r[4],
                        "force_end_at": r[5],
                    }
                    for r in sessions
                ],
                "audit_logs": [
                    {"timestamp": r[0], "username": r[1], "action": r[2], "details": r[3]}
                    for r in audits
                ],
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/audit-logs")
async def get_all_audit_logs(user=Depends(get_current_user)):
    _require_admin(user)
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT timestamp, username, action, details FROM audit_logs ORDER BY id DESC LIMIT 100")).fetchall()
            logs = [{"timestamp": r[0], "username": r[1], "action": r[2], "details": r[3]} for r in res]
            return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/accounts/{target_username}/activity")
async def get_account_activity(target_username: str, user=Depends(get_current_user)):
    _require_admin(user)
    try:
        with engine.connect() as conn:
            res = conn.execute(
                text("SELECT timestamp, username, action, details FROM audit_logs WHERE username = :u OR details LIKE :needle ORDER BY id DESC LIMIT 100"),
                {"u": target_username, "needle": f"%{target_username}%"}
            ).fetchall()
            logs = [{"timestamp": r[0], "username": r[1], "action": r[2], "details": r[3]} for r in res]
            return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# DATA INGESTION
# ==========================================
def analyze_dataset_gaps(df):
    if df.empty or 'OrderDate' not in df.columns:
        return None, None, "Continuous"
        
    start_date = df['OrderDate'].min()
    end_date = df['OrderDate'].max()
    dr_start = start_date.strftime('%Y-%m-%d') if pd.notnull(start_date) else None
    dr_end = end_date.strftime('%Y-%m-%d') if pd.notnull(end_date) else None

    gap_str = "Continuous"
    if pd.notnull(start_date) and pd.notnull(end_date):
        unique_years = df['OrderDate'].dt.year.dropna().unique()
        if len(unique_years) > 0:
            expected_years = list(range(int(start_date.year), int(end_date.year) + 1))
            missing_years = [y for y in expected_years if y not in unique_years]
            if missing_years:
                gap_str = "Missing Years: " + ", ".join(map(str, missing_years))
            else:
                unique_months = df['OrderDate'].dt.to_period('M').unique()
                expected_months = pd.period_range(start=start_date, end=end_date, freq='M')
                missing_months = expected_months.difference(unique_months)
                if not missing_months.empty:
                    if len(missing_months) > 5:
                        gap_str = f"Missing {len(missing_months)} Months"
                    else:
                        gap_str = "Missing Months: " + ", ".join(missing_months.strftime('%b %Y'))
    return dr_start, dr_end, gap_str

@app.post("/api/scan-items")
async def scan_file_for_items(
    files: List[UploadFile] = File(...),
    user=Depends(get_current_user)
):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        unique_items = set()
        COLUMN_ALIASES = {
            'itemdescription': 'ItemDescription', 'item description': 'ItemDescription', 'item': 'ItemDescription',
        }

        for file in files:
            contents = await file.read()
            if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
                xl = pd.ExcelFile(io.BytesIO(contents))
                for sheet in xl.sheet_names:
                    sheet_df = xl.parse(sheet)
                    sheet_df.columns = sheet_df.columns.str.strip().str.lower().str.replace(' ', '').str.replace('_', '')
                    sheet_df = sheet_df.rename(columns=COLUMN_ALIASES)
                    if 'ItemDescription' in sheet_df.columns:
                        unique_items.update(sheet_df['ItemDescription'].dropna().unique().tolist())
            else:
                csv_df = pd.read_csv(io.BytesIO(contents))
                csv_df.columns = csv_df.columns.str.strip().str.lower().str.replace(' ', '').str.replace('_', '')
                csv_df = csv_df.rename(columns=COLUMN_ALIASES)
                if 'ItemDescription' in csv_df.columns:
                    unique_items.update(csv_df['ItemDescription'].dropna().unique().tolist())

        return {"items": sorted(list(unique_items))}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-data")
async def process_sales_data(
    title: str = Form(...),
    dataset_type: str = Form("MASTER"),
    item_configs: str = Form("{}"), # Kept for backward compat but ignored
    files: List[UploadFile] = File(...),
    user=Depends(get_current_user)
):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required to upload data")
    try:
        all_frames = []
        filenames = []

        # STRICT COLUMN MAPPING
        COLUMN_ALIASES = {
            'itemdescription': 'ItemDescription', 'item description': 'ItemDescription', 'item': 'ItemDescription',
                'orderid': 'OrderID', 'order id': 'OrderID',
            'orderdate': 'OrderDate', 'order date': 'OrderDate',
            'quantity': 'Quantity',
            'total': 'Total',
            'customerid': 'CustomerID', 'customer id': 'CustomerID', 'customer': 'CustomerID'
        }

        for file in files:
            contents = await file.read()
            filenames.append(file.filename)

            if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
                xl = pd.ExcelFile(io.BytesIO(contents))
                for sheet in xl.sheet_names:
                    try:
                        sheet_df = xl.parse(sheet)
                        sheet_df.columns = sheet_df.columns.str.strip().str.lower().str.replace(' ', '').str.replace('_', '')
                        sheet_df = sheet_df.rename(columns=COLUMN_ALIASES)
                        all_frames.append(sheet_df)
                    except Exception:
                        continue
            else:
                csv_df = pd.read_csv(io.BytesIO(contents))
                csv_df.columns = csv_df.columns.str.strip().str.lower().str.replace(' ', '').str.replace('_', '')
                csv_df = csv_df.rename(columns=COLUMN_ALIASES)
                all_frames.append(csv_df)

        if not all_frames:
            raise HTTPException(status_code=400, detail="No readable data found in uploaded files.")

        df = pd.concat(all_frames, ignore_index=True)
        
        # STRICT CLEANING: KEEP ONLY 5 COLUMNS
        REQUIRED_COLUMNS = ['ItemDescription', 'OrderID', 'OrderDate', 'Quantity', 'Total', 'CustomerID']
        # Check if all required columns exist after mapping
        missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required columns after mapping: {', '.join(missing)}")
        
        df = df[REQUIRED_COLUMNS].copy()

        # ROBUST DATE PARSING
        # Formats: DD/MM/YYYY HH:MM:SS AM/PM and D/MM/YYYY HH:MM:SS AM/PM
        def parse_custom_date(date_str):
            if pd.isna(date_str): return pd.NaT
            date_str = str(date_str).strip()
            for fmt in ["%d/%m/%Y %I:%M:%S %p", "%e/%m/%Y %I:%M:%S %p", "%d/%m/%Y", "%Y-%m-%d"]:
                try:
                    return pd.to_datetime(date_str, format=fmt)
                except:
                    continue
            return pd.to_datetime(date_str, errors='coerce')

        df['OrderDate'] = df['OrderDate'].apply(parse_custom_date)
        df['Quantity'] = pd.to_numeric(df['Quantity'], errors='coerce')
        df['Total'] = pd.to_numeric(df['Total'], errors='coerce')
        
        # [CLEANING] Filter out invalid records: missing essential fields, non-positive quantity/total, or empty strings
        valid_sales = df.dropna(subset=['ItemDescription', 'OrderID', 'OrderDate', 'CustomerID']).copy()
        
        # Ensure ItemDescription is not just whitespace
        valid_sales = valid_sales[valid_sales['ItemDescription'].astype(str).str.strip().str.len() > 0]
        
        # Filter out 0 or NaN/negative values for Quantity and Total
        valid_sales = valid_sales[(valid_sales['Quantity'] > 0) & (valid_sales['Total'] > 0)]
        
        valid_sales = valid_sales.drop_duplicates(subset=['OrderID', 'ItemDescription', 'OrderDate'])

        combined_filename = ", ".join(filenames)
        
        dr_start, dr_end, gap_info_str = analyze_dataset_gaps(valid_sales)

        with engine.connect() as conn:
            now = datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")
            dataset_id = _insert_and_get_id(
                conn,
                "INSERT INTO datasets (title, filename, upload_date, uploader, row_count, is_private, dataset_type, date_range_start, date_range_end, gap_info) VALUES (:t, :f, :d, :u, :rc, 0, :dt, :drs, :dre, :gap)",
                {"t": title, "f": combined_filename, "d": now, "u": user['username'], "rc": len(valid_sales), "dt": dataset_type, "drs": dr_start, "dre": dr_end, "gap": gap_info_str}
            )

            conn.commit()

            valid_sales['dataset_id'] = dataset_id
            valid_sales.to_sql("sales_transactions", engine, if_exists="append", index=False)
            conn.commit()

            # [PERFORMANCE] Pre-aggregate data for faster training
            print(f"OPTIMA: Pre-aggregating data for dataset {dataset_id}...")
            agg_df = valid_sales.copy()
            agg_df['OrderDate'] = pd.to_datetime(agg_df['OrderDate'])
            agg_df['ds'] = agg_df['OrderDate'].dt.to_period('M').dt.to_timestamp()
            
            # Count months per item
            item_counts = agg_df.groupby('ItemDescription')['ds'].nunique()
            eligible_items = item_counts[item_counts >= 12].index.tolist()
            print(f"OPTIMA: {len(eligible_items)} items meet 12-month threshold for aggregation.")

            # Filter only eligible items for the aggregated table
            filtered_agg = agg_df[agg_df['ItemDescription'].isin(eligible_items)]
            
            # Aggregate Volume (Quantity)
            monthly_agg_qty = filtered_agg.groupby(['ItemDescription', 'ds'])['Quantity'].sum().reset_index()
            for _, row in monthly_agg_qty.iterrows():
                conn.execute(
                    text("INSERT INTO aggregated_sales (dataset_id, ItemDescription, ds, y, metric_type) VALUES (:d, :item, :ds, :y, 'Volume')"),
                    {"d": dataset_id, "item": row['ItemDescription'], "ds": row['ds'].strftime('%Y-%m-%d'), "y": float(row['Quantity'])}
                )
            
            # Aggregate Revenue (Total)
            monthly_agg_rev = filtered_agg.groupby(['ItemDescription', 'ds'])['Total'].sum().reset_index()
            for _, row in monthly_agg_rev.iterrows():
                conn.execute(
                    text("INSERT INTO aggregated_sales (dataset_id, ItemDescription, ds, y, metric_type) VALUES (:d, :item, :ds, :y, 'Revenue')"),
                    {"d": dataset_id, "item": row['ItemDescription'], "ds": row['ds'].strftime('%Y-%m-%d'), "y": float(row['Total'])}
                )
            conn.commit()

            # [NEW] Save simplified item metadata
            import json
            try:
                parsed_configs = json.loads(item_configs)
            except:
                parsed_configs = {}

            # We iterate over unique items in the valid_sales to ensure all products are captured
            all_unique_items = valid_sales['ItemDescription'].unique()
            for item in all_unique_items:
                config = parsed_configs.get(item, {})
                is_bundle = 1 if config.get('bundle') else 0
                is_not_product = 1 if config.get('is_not_product') else 0
                
                conn.execute(
                    text("INSERT INTO item_metadata (dataset_id, ItemDescription, is_bundle, is_not_product) VALUES (:d, :item, :b, :np)"),
                    {"d": dataset_id, "item": item, "b": is_bundle, "np": is_not_product}
                )
            conn.commit()

            log_audit(conn, user['username'], "UPLOAD_DATA", f"Uploaded dataset '{title}' ({len(valid_sales)} rows, {len(monthly_agg_qty)} aggregated)")
            return {"status": "success", "dataset_id": dataset_id, "rows": len(valid_sales)}
            
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# DATASET MANAGEMENT
# ==========================================
@app.get("/api/datasets")
async def get_datasets(user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            if user.get("role") == "ADMIN":
                query = "SELECT id, title, filename, upload_date, uploader, row_count, is_private, is_active, dataset_type, date_range_start, date_range_end, gap_info, last_edited_at FROM datasets ORDER BY id DESC"

                res = conn.execute(text(query)).fetchall()
            else:
                query = "SELECT id, title, filename, upload_date, uploader, row_count, is_private, is_active, dataset_type, date_range_start, date_range_end, gap_info, last_edited_at FROM datasets WHERE is_private = 0 ORDER BY id DESC"

                res = conn.execute(text(query)).fetchall()
            
            datasets = []
            for r in res:
                dt = r[8] if len(r) > 8 else "MASTER"
                drs = r[9] if len(r) > 9 else None
                dre = r[10] if len(r) > 10 else None
                gap = r[11] if len(r) > 11 else None
                datasets.append({
                    "id": r[0],
                    "title": r[1],
                    "filename": r[2],
                    "upload_date": r[3],
                    "uploader": r[4],
                    "row_count": r[5],
                    "is_private": bool(r[6]),
                    "is_active": bool(r[7]),
                    "dataset_type": dt,
                    "date_range_start": drs,
                    "date_range_end": dre,
                    "gap_info": gap,
                    "last_edited_at": r[12] if len(r) > 12 else None
                })
            return {"datasets": datasets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CombineRequest(BaseModel):
    title: str
    dataset_ids: List[int]

@app.post("/api/combine-datasets")
async def combine_datasets(req: CombineRequest, user=Depends(get_current_user)):
    try:
        df_list = []
        filenames = []
        for d_id in req.dataset_ids:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT filename FROM datasets WHERE id = :id"), {"id": d_id}).fetchone()
                if res:
                    filenames.append(res[0])
            df = _read_sql("SELECT * FROM sales_transactions WHERE dataset_id = :dataset_id", {"dataset_id": d_id})
            if not df.empty:
                df_list.append(df)
                
        if not df_list:
            raise HTTPException(status_code=400, detail="No data found in selected datasets.")
            
        combined_df = pd.concat(df_list, ignore_index=True)
        # Drop duplicates across combined years
        combined_df = combined_df.drop_duplicates(subset=['OrderID', 'ItemDescription', 'OrderDate'])
        
        combined_filename = "COMBINED: " + ", ".join(filenames)[:200]
        dr_start, dr_end, gap_info_str = analyze_dataset_gaps(combined_df)
        
        with engine.connect() as conn:
            now = (datetime.datetime.utcnow().isoformat() + "Z")
            new_dataset_id = _insert_and_get_id(
                conn,
                "INSERT INTO datasets (title, filename, upload_date, uploader, row_count, is_private, dataset_type, date_range_start, date_range_end, gap_info) VALUES (:t, :f, :d, :u, :rc, 1, 'MASTER', :drs, :dre, :gap)",
                {"t": req.title, "f": combined_filename, "d": now, "u": user['username'], "rc": len(combined_df), "drs": dr_start, "dre": dr_end, "gap": gap_info_str}
            )
            conn.commit()
            
            combined_df['dataset_id'] = new_dataset_id
            combined_df.to_sql("sales_transactions", engine, if_exists="append", index=False)
            
            log_audit(conn, user['username'], "COMBINE_DATASETS", f"Combined {len(req.dataset_ids)} datasets into '{req.title}' ({len(combined_df)} rows)")
            conn.commit()
            
        return {"status": "success", "dataset_id": new_dataset_id, "total_rows": len(combined_df)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/data")
async def get_dataset_data(dataset_id: int, page: int = 1, limit: int = 50, year: str = None, sort_by: str = "OrderID", sort_dir: str = "DESC", user=Depends(get_current_user)):
    try:
        offset = (page - 1) * limit
        where_clause = "dataset_id = :dataset_id"
        params = {"dataset_id": dataset_id, "limit": limit, "offset": offset}
        if year:
            where_clause += f" AND {_year_expr('OrderDate')} = :year"
            params["year"] = year
        
        # Validate sort_by to prevent SQL injection
        allowed_cols = ["OrderID", "ItemDescription", "OrderDate", "Quantity", "Total"]
        if sort_by not in allowed_cols: sort_by = "OrderID"
        direction = "DESC" if sort_dir.upper() == "DESC" else "ASC"
            
        df = _read_sql(f"SELECT * FROM sales_transactions WHERE {where_clause} ORDER BY {_ident(sort_by)} {direction} LIMIT :limit OFFSET :offset", params)
        
        with engine.connect() as conn:
            if year:
                total_rows_res = conn.execute(text(f"SELECT COUNT(*) FROM sales_transactions WHERE {where_clause}"), params).fetchone()
                total_rows = total_rows_res[0] if total_rows_res else 0
            else:
                total_rows_res = conn.execute(text("SELECT row_count FROM datasets WHERE id=:id"), {"id": dataset_id}).fetchone()
                total_rows = total_rows_res[0] if total_rows_res else 0
            
        # Replace NaN, Inf, -Inf with None for JSON serialization
        df = df.replace([np.nan, np.inf, -np.inf], None)
        data = df.to_dict(orient="records")
        return {
            "status": "success",
            "data": data,
            "page": page,
            "limit": limit,
            "total_rows": total_rows
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/years")
async def get_dataset_years(dataset_id: int, user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            year_expr = _year_expr("OrderDate")
            res = conn.execute(text(f"SELECT DISTINCT {year_expr} as yr FROM sales_transactions WHERE dataset_id=:id AND {year_expr} IS NOT NULL ORDER BY yr ASC"), {"id": dataset_id}).fetchall()
            years = [r[0] for r in res if r[0]]
        return {"status": "success", "years": years}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/aggregated")
async def get_dataset_aggregated_data(dataset_id: int, page: int = 1, limit: int = 50, sort_by: str = "ds", sort_dir: str = "ASC", metric: str = "Volume", user=Depends(get_current_user)):
    try:
        offset = (page - 1) * limit
        
        # [FAIL-SAFE] If this is an old dataset, aggregate it now
        with engine.connect() as conn:
            exists = conn.execute(text("SELECT 1 FROM aggregated_sales WHERE dataset_id=:id LIMIT 1"), {"id": dataset_id}).fetchone()
            if not exists:
                print(f"OPTIMA: Retro-aggregating dataset {dataset_id}...")
                raw_df = _read_sql(f"SELECT {_ident('ItemDescription')}, {_ident('OrderDate')}, {_ident('Quantity')}, {_ident('Total')} FROM sales_transactions WHERE dataset_id = :dataset_id", {"dataset_id": dataset_id})
                if not raw_df.empty:
                    raw_df['OrderDate'] = pd.to_datetime(raw_df['OrderDate'])
                    raw_df['ds'] = raw_df['OrderDate'].dt.to_period('M').dt.to_timestamp()
                    
                    # Aggregate Volume
                    agg_qty = raw_df.groupby(['ItemDescription', 'ds'])['Quantity'].sum().reset_index()
                    for _, row in agg_qty.iterrows():
                        conn.execute(
                            text("INSERT INTO aggregated_sales (dataset_id, ItemDescription, ds, y, metric_type) VALUES (:d, :item, :ds, :y, 'Volume')"),
                            {"d": dataset_id, "item": row['ItemDescription'], "ds": row['ds'].strftime('%Y-%m-%d'), "y": float(row['Quantity'])}
                        )
                    
                    # Aggregate Revenue
                    agg_rev = raw_df.groupby(['ItemDescription', 'ds'])['Total'].sum().reset_index()
                    for _, row in agg_rev.iterrows():
                        conn.execute(
                            text("INSERT INTO aggregated_sales (dataset_id, ItemDescription, ds, y, metric_type) VALUES (:d, :item, :ds, :y, 'Revenue')"),
                            {"d": dataset_id, "item": row['ItemDescription'], "ds": row['ds'].strftime('%Y-%m-%d'), "y": float(row['Total'])}
                        )
                    conn.commit()

        allowed_cols = ["ds", "ItemDescription", "y"]
        if sort_by not in allowed_cols: sort_by = "ds"
        direction = "DESC" if sort_dir.upper() == "DESC" else "ASC"

        df = _read_sql(f"SELECT * FROM aggregated_sales WHERE dataset_id = :dataset_id AND metric_type = :metric ORDER BY {sort_by} {direction} LIMIT :limit OFFSET :offset", {"dataset_id": dataset_id, "limit": limit, "offset": offset, "metric": metric})
        
        with engine.connect() as conn:
            total_rows_res = conn.execute(text("SELECT COUNT(*) FROM aggregated_sales WHERE dataset_id=:id AND metric_type = :metric"), {"id": dataset_id, "metric": metric}).fetchone()
            total_rows = total_rows_res[0] if total_rows_res else 0
            
        data = df.to_dict(orient="records")
        return {
            "status": "success",
            "data": data,
            "page": page,
            "limit": limit,
            "total_rows": total_rows
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/aggregated/global")
async def get_dataset_global_aggregated_data(dataset_id: int, metric: str = "Volume", user=Depends(get_current_user)):
    try:
        # SUM all items per month for this dataset
        df = _read_sql("SELECT ds, SUM(y) as total_quantity FROM aggregated_sales WHERE dataset_id = :dataset_id AND metric_type = :metric GROUP BY ds ORDER BY ds ASC", {"dataset_id": dataset_id, "metric": metric})
        data = df.to_dict(orient="records")
        return {
            "status": "success",
            "data": data,
            "total_rows": len(data)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/datasets/{dataset_id}/activate")
async def activate_dataset(dataset_id: int, user=Depends(get_current_user)):
    """Any authenticated user can select the active dataset for analysis."""
    global _qualitative_cache
    try:
        from pathlib import Path
        with engine.connect() as conn:
            # Deactivate all, then activate the chosen one
            conn.execute(text("UPDATE datasets SET is_active = 0"))
            conn.execute(text("UPDATE datasets SET is_active = 1 WHERE id = :id"), {"id": dataset_id})
            conn.commit()
            log_audit(conn, user['username'], "ACTIVATE_DATASET", f"Activated dataset ID {dataset_id} for analysis")
            conn.commit()
        
        # Invalidate qualitative cache
        _qualitative_cache = {"dataset_id": None, "rules_df": None}
        print("OPTIMA: Qualitative cache invalidated (dataset changed).")
        
        # Invalidate parameter cache
        param_cache_path = Path(__file__).parent / "backend_storage" / "model_parameters_cache.json"
        if param_cache_path.exists():
            param_cache_path.write_text("{}")
            print("OPTIMA: Parameter cache cleared (dataset changed).")
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/active-dataset")
async def get_active_dataset(user=Depends(get_current_user)):
    """Returns the currently active dataset metadata."""
    try:
        with engine.connect() as conn:
            row = conn.execute(text(
                "SELECT id, title, row_count FROM datasets WHERE is_active = 1 LIMIT 1"
            )).fetchone()
            if row:
                return {"active": {"id": row[0], "title": row[1], "row_count": row[2]}}
            return {"active": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/datasets/{dataset_id}")
async def delete_dataset(dataset_id: int, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            # Delete transaction data
            conn.execute(text("DELETE FROM sales_transactions WHERE dataset_id = :id"), {"id": dataset_id})
            # Delete metadata
            conn.execute(text("DELETE FROM datasets WHERE id = :id"), {"id": dataset_id})
            conn.commit()
            log_audit(conn, user['username'], "DELETE_DATASET", f"Deleted dataset ID {dataset_id}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DatasetPatchModel(BaseModel):
    title: str = None
    is_private: bool = None

@app.patch("/api/datasets/{dataset_id}")
async def patch_dataset(dataset_id: int, data: DatasetPatchModel, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            now = (datetime.datetime.utcnow().isoformat() + "Z")
            if data.title is not None:

                conn.execute(text("UPDATE datasets SET title = :t, last_edited_at = :now WHERE id = :id"), {"t": data.title, "id": dataset_id, "now": now}
)
            if data.is_private is not None:
                conn.execute(text("UPDATE datasets SET is_private = :p, last_edited_at = :now WHERE id = :id"), {"p": 1 if data.is_private else 0, "id": dataset_id, "now": now})
            conn.commit()
            log_audit(conn, user['username'], "PATCH_DATASET", f"Updated dataset ID {dataset_id}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- BLOCKED ITEMS ENDPOINTS REMOVED ---

# ==========================================
# CUSTOM BUNDLE ANALYSIS
# ==========================================
class BundleAnalysisRequest(BaseModel):
    items: list
@app.get("/api/get-items")
async def get_all_items(dataset_ids: Optional[str] = Query(None), user=Depends(get_current_user)):
    try:
        if not dataset_ids:
            target_id = _get_active_dataset_id()
            if target_id is None:
                return {"items": []}
            ids_str = str(target_id)
        else:
            ids = _parse_id_csv(dataset_ids)

        if not dataset_ids:
            ids = [int(ids_str)]
        raw_df = _read_sql_in(f"SELECT DISTINCT {_ident('ItemDescription')} FROM sales_transactions WHERE dataset_id IN :dataset_ids ORDER BY {_ident('ItemDescription')}", "dataset_ids", ids)
        return {"items": raw_df['ItemDescription'].tolist()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/metadata")
async def get_dataset_metadata(dataset_id: int, user=Depends(get_current_user)):
    """Returns the simplified item metadata (bundle and product status) for a dataset."""
    try:
        with engine.connect() as conn:
            query = text("SELECT ItemDescription, is_bundle, is_not_product FROM item_metadata WHERE dataset_id = :id")
            res = conn.execute(query, {"id": dataset_id}).fetchall()
            
            metadata = {}
            for row in res:
                metadata[row[0]] = {
                    "bundle": bool(row[1]),
                    "is_not_product": bool(row[2])
                }
            return metadata
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/datasets/{dataset_id}/metadata")
async def update_dataset_metadata(dataset_id: int, payload: dict = Body(...), user=Depends(get_current_user)):
    """Updates the item metadata for a dataset."""
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            # We use a transaction to update efficiently
            for item, config in payload.items():
                is_bundle = 1 if config.get('bundle') else 0
                is_not_product = 1 if config.get('is_not_product') else 0
                
                conn.execute(
                    text("UPDATE item_metadata SET is_bundle = :b, is_not_product = :np WHERE dataset_id = :id AND ItemDescription = :item"),
                    {"b": is_bundle, "np": is_not_product, "id": dataset_id, "item": item}
                )
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ItemsRequest(BaseModel):
    dataset_ids: List[int]

@app.post("/api/datasets/items")
async def get_items_from_multiple_datasets(req: ItemsRequest, user=Depends(get_current_user)):
    """Returns a unique list of items found across the selected datasets."""
    try:
        if not req.dataset_ids:
            return {"items": []}
        df = _read_sql_in(f"SELECT DISTINCT {_ident('ItemDescription')} FROM sales_transactions WHERE dataset_id IN :dataset_ids ORDER BY {_ident('ItemDescription')}", "dataset_ids", req.dataset_ids)
        return {"items": df['ItemDescription'].tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-bundle")
async def handle_custom_bundle_analysis(data: BundleAnalysisRequest, user=Depends(get_current_user)):
    try:
        raw_df, active_id = _get_active_dataset_df()
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
    global _qualitative_cache
# ==========================================
# PERSISTENT FORECASTING SYSTEM
# ==========================================
class ForecastTrainRequest(BaseModel):
    dataset_ids: List[int]
    run_name: str
    items: Optional[List[str]] = None
    item_configs: Optional[dict] = None
    train_forecast: bool = False
    train_bundler: bool = False
    save_bundler: bool = False
    ref_forecast_id: Optional[Union[int, str]] = "none"
    min_support: float = 0.01
    end_date: Optional[str] = None


class CommitBundlerRequest(BaseModel):
    name: str
    dataset_id: int
    forecast_ref_id: Optional[Union[int, str]] = "none"
    bundles: List[dict]

@app.post("/api/forecast/cancel/{run_id}")
async def cancel_forecast_run(run_id: str, user=Depends(get_current_user)):
    cancelled_runs.add(run_id)
    print(f"OPTIMA: Received cancellation signal for run {run_id}")
    return {"status": "cancelled"}

def get_unique_run_name(conn, dataset_id, base_name, table="forecast_runs"):
    """
    Recursively finds a unique name for a run within a dataset.
    e.g. "Run" -> "Run (2)"
    """
    query = text(f"SELECT id FROM {table} WHERE dataset_id = :d AND name = :n")
    res = conn.execute(query, {"d": dataset_id, "n": base_name}).fetchone()
    if not res:
        return base_name
    
    # Try with suffixes
    count = 2
    while True:
        new_name = f"{base_name} ({count})"
        res = conn.execute(query, {"d": dataset_id, "n": new_name}).fetchone()
        if not res:
            return new_name
        count += 1

@app.post("/api/forecast/train")
async def train_and_save_model(req: ForecastTrainRequest, user=Depends(get_current_user)):
    """
    Executes the full forecasting pipeline and saves results persistently.
    """
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    try:
        # 1. Fetch PRE-AGGREGATED Data
        raw_df = _read_sql_in(f"SELECT {_agg_item_select()}, ds, y FROM aggregated_sales WHERE dataset_id IN :dataset_ids AND metric_type = 'Volume'", "dataset_ids", req.dataset_ids)
        
        if raw_df.empty:
            # Attempt to retro-aggregate if missing
            with engine.connect() as conn:
                for did in req.dataset_ids:
                    metric_exists = conn.execute(text("SELECT 1 FROM aggregated_sales WHERE dataset_id=:id AND metric_type='Volume' LIMIT 1"), {"id": did}).fetchone()
                    if not metric_exists:
                        print(f"OPTIMA: Retro-aggregating Volume for dataset {did}...")
                        col = "Quantity"
                        raw = _read_sql(f"SELECT {_ident('ItemDescription')}, {_ident('OrderDate')}, {_ident(col)} FROM sales_transactions WHERE dataset_id = :dataset_id", {"dataset_id": did})
                        if not raw.empty:
                            raw['OrderDate'] = pd.to_datetime(raw['OrderDate'])
                            raw['ds'] = raw['OrderDate'].dt.to_period('M').dt.to_timestamp()
                            agg = raw.groupby(['ItemDescription', 'ds'])[col].sum().reset_index()
                            for _, row in agg.iterrows():
                                conn.execute(
                                    text("INSERT INTO aggregated_sales (dataset_id, ItemDescription, ds, y, metric_type) VALUES (:d, :item, :ds, :y, 'Volume')"),
                                    {"d": did, "item": row['ItemDescription'], "ds": row['ds'].strftime('%Y-%m-%d'), "y": float(row[col])}
                                )
                            conn.commit()
            
            # Re-fetch
            raw_df = _read_sql_in(f"SELECT {_agg_item_select()}, ds, y FROM aggregated_sales WHERE dataset_id IN :dataset_ids AND metric_type = 'Volume'", "dataset_ids", req.dataset_ids)
            if raw_df.empty:
                raise HTTPException(status_code=400, detail="Datasets are empty or not aggregated.")

        # [NEW] Fetch metadata to filter out non-product items
        meta_df = _read_sql_in("SELECT ItemDescription, is_not_product FROM item_metadata WHERE dataset_id IN :dataset_ids", "dataset_ids", req.dataset_ids)
        if not meta_df.empty:
            meta_df.columns = [c.lower() for c in meta_df.columns]
            non_product_items = set(meta_df[meta_df['is_not_product'] == 1]['itemdescription'].tolist())
        else:
            non_product_items = set()
        
        # Filter raw_df
        raw_df = raw_df[~raw_df['ItemDescription'].isin(non_product_items)]
        
        if raw_df.empty:
            raise HTTPException(status_code=400, detail="Datasets contain only non-product items after filtering.")

        # Ensure types
        raw_df['ds'] = pd.to_datetime(raw_df['ds'])
        
        # Determine target end_date if missing (12 months ahead)
        target_end_date = req.end_date
        if not target_end_date:
            last_dt = raw_df['ds'].max()
            target_end_date = (last_dt + pd.DateOffset(months=12)).strftime('%Y-%m-%d')

        performance_metrics = {}
        all_results = [] # To be saved in DB
        run_id = None
        
        # Ensure unique name for forecast if training
        with engine.connect() as conn:
            if req.train_forecast:
                req.run_name = get_unique_run_name(conn, req.dataset_ids[0], req.run_name, "forecast_runs")
            elif req.train_bundler:
                req.run_name = get_unique_run_name(conn, req.dataset_ids[0], req.run_name, "bundler_runs")

        if req.train_forecast:
            # --- CORE PIPELINE (Phase 1 & 2) ---
            from concurrent.futures import ThreadPoolExecutor
            
            # Phase 1: Global
            print(f"OPTIMA: Training Global Baseline for '{req.run_name}'...")
            # Since it's already aggregated by item/month, we sum all items per month
            global_agg = raw_df.groupby('ds')['y'].sum().reset_index()
            global_forecast = preprocess_and_forecast_item(global_agg, target_end_date, "GLOBAL_STORE_TOTAL", history_end=last_dt)
            if not global_forecast.empty:
                global_forecast['ItemDescription'] = 'GLOBAL_BASELINE'
                all_results.append(('GLOBAL_BASELINE', global_forecast))
                
                # Persist global metrics too
                metrics = global_forecast.attrs.get('metrics', {})
                metrics['stl'] = global_forecast.attrs.get('stl', {})
                performance_metrics['GLOBAL_BASELINE'] = metrics

            # Phase 2: Items
            target_items = req.items
            if not target_items:
                # [PRE-FILTER] Only model items that meet the 12-month threshold
                print("OPTIMA: Filtering items based on 12-month historical threshold...")
                count_df = raw_df.groupby('ItemDescription')['ds'].nunique().reset_index()
                eligible_items = count_df[count_df['ds'] >= 12]['ItemDescription'].tolist()
                print(f"OPTIMA: {len(eligible_items)} products passed threshold (out of {len(count_df)} total)")
                target_items = eligible_items
                
            def process_item(item):
                try:
                    item_df = raw_df[raw_df['ItemDescription'] == item].copy()
                    forecast = preprocess_and_forecast_item(item_df, target_end_date, item, history_end=last_dt)
                    
                    if not forecast.empty:
                        forecast['ItemDescription'] = item
                        metrics = forecast.attrs.get('metrics', {})
                        metrics['stl'] = forecast.attrs.get('stl', {})
                        metrics['tags'] = []
                        
                        return item, forecast, metrics
                except Exception as ex:
                    print(f"OPTIMA: Error in process_item for {item}: {ex}")
                    traceback.print_exc()
                return None

            import os
            import uuid
            temp_run_id = str(uuid.uuid4())
            
            item_results = []
            
            max_workers = min(8, os.cpu_count() or 4)
            print(f"OPTIMA: Training {len(target_items)} items in parallel using {max_workers} threads...")
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(process_item, item): item for item in target_items}
                for fut in futures:
                    if temp_run_id in cancelled_runs:
                        print(f"OPTIMA: Run {temp_run_id} was ABORTED by user. Stopping pipeline.")
                        cancelled_runs.remove(temp_run_id)
                        for f in futures:
                            f.cancel()
                        return {"status": "aborted"}
                    
                    try:
                        res = fut.result()
                        if res:
                            item_results.append(res)
                    except Exception as ex:
                        item = futures[fut]
                        print(f"OPTIMA: [{item}] thread raised exception: {ex}")
                        traceback.print_exc()
                    
            for res in item_results:
                item, forecast, metrics = res
                all_results.append((item, forecast))
                performance_metrics[item] = metrics

            # 2. Persist to Database
            with engine.connect() as conn:
                now = (datetime.datetime.utcnow().isoformat() + "Z")
                run_id = _insert_and_get_id(
                    conn,
                    "INSERT INTO forecast_runs (name, dataset_id, created_at, config_json) VALUES (:n, :d, :c, :cj)",
                    {"n": req.run_name, "d": req.dataset_ids[0], "c": now, "cj": json.dumps({"end_date": target_end_date, "metric": "Volume", "item_count": len(all_results), "dataset_ids": req.dataset_ids})}
                )
                
                for item, df in all_results:
                    res_json = df.to_json(orient="records")
                    if item in performance_metrics:
                        meta = {"metrics": performance_metrics[item]}
                        res_json = json.dumps({"data": json.loads(res_json), "meta": meta})
                    else:
                        res_json = json.dumps({"data": json.loads(res_json), "meta": {}})

                    conn.execute(
                        text("INSERT INTO forecast_results (run_id, item_description, result_json) VALUES (:rid, :item, :rj)"),
                        {"rid": run_id, "item": item, "rj": res_json}
                    )
                
                log_audit(conn, user['username'], "TRAIN_FORECAST", f"Saved forecast run '{req.run_name}' (ID: {run_id})")
                conn.commit()

        # [NEW] PHASE 3: BUNDLER (IF REQUESTED)
        ranked_bundles = []
        if req.train_bundler:
            print(f"OPTIMA: Triggering Bundler Engine for '{req.run_name}'...")
            dataset_id = req.dataset_ids[0]
            
            # Resolve reference ID for the engine logic
            ref_id = None
            if req.train_forecast:
                ref_id = run_id
            elif req.ref_forecast_id != "none" and req.ref_forecast_id != "auto":
                ref_id = req.ref_forecast_id
            
            # AUTO-SAVE logic: If both engines ran, persist automatically.
            # If bundler runs standalone, only save when explicitly requested.
            bundler_run_id = None
            should_save_bundler = req.train_bundler and (req.train_forecast or req.save_bundler)
            if should_save_bundler:
                with engine.connect() as conn:
                    now = (datetime.datetime.utcnow().isoformat() + "Z")
                    # Resolve ref_id
                    if req.train_forecast:
                        ref_id = run_id
                    bundler_run_id = _insert_and_get_id(
                        conn,
                        "INSERT INTO bundler_runs (dataset_id, name, created_at, forecast_run_id) VALUES (:d, :n, :t, :f)",
                        {"d": dataset_id, "n": req.run_name, "t": now, "f": ref_id}
                    )
                    conn.commit()

            # Run engine
            ranked_bundles = generate_strategic_bundles(
                engine, dataset_id, 
                bundler_run_id=bundler_run_id, 
                forecast_run_id=run_id if req.train_forecast else (ref_id if ref_id else None), 
                min_support=req.min_support
            )
            print(f"OPTIMA: Discovery complete. Found {len(ranked_bundles)} bundles. Auto-Save: {bundler_run_id is not None}")

        return {
            "status": "success", 
            "run_id": run_id if req.train_forecast else None, 
            "bundler_run_id": bundler_run_id,
            "item_count": len(all_results),
            "bundles": ranked_bundles,
            "auto_saved": bundler_run_id is not None
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/forecast/runs")
async def get_forecast_runs(dataset_id: int = None, user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            query = "SELECT id, name, dataset_id, created_at, status, config_json FROM forecast_runs"
            params = {}
            if dataset_id:
                query += " WHERE dataset_id = :dataset_id"
                params["dataset_id"] = dataset_id
            query += " ORDER BY id DESC"
            res = conn.execute(text(query), params).fetchall()
            
            runs = []
            for r in res:
                runs.append({
                    "id": r[0],
                    "name": r[1],
                    "dataset_id": r[2],
                    "created_at": r[3],
                    "status": r[4],
                    "config": json.loads(r[5]) if r[5] else {}
                })
            return {"runs": runs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/forecast-runs")
async def get_dataset_forecast_runs(dataset_id: int, user=Depends(get_current_user)):
    """Fetch forecast runs for a specific dataset"""
    try:
        with engine.connect() as conn:
            query = "SELECT id, name, dataset_id, created_at, status, config_json FROM forecast_runs WHERE dataset_id = :d ORDER BY id DESC"
            res = conn.execute(text(query), {"d": dataset_id}).fetchall()
            
            runs = []
            for r in res:
                runs.append({
                    "id": r[0],
                    "name": r[1],
                    "dataset_id": r[2],
                    "created_at": r[3],
                    "status": r[4],
                    "config": json.loads(r[5]) if r[5] else {}
                })
            return {"runs": runs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/forecast/runs/{run_id}")
async def get_forecast_run_details(run_id: int, user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            res = conn.execute(
                text("SELECT item_description, result_json FROM forecast_results WHERE run_id = :rid"),
                {"rid": run_id}
            ).fetchall()
            
            results = {}
            for item, rj in res:
                results[item] = json.loads(rj)
            
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/forecast/runs/{run_id}")
async def delete_forecast_run(run_id: int, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM forecast_runs WHERE id = :id"), {"id": run_id})
            conn.commit()
            log_audit(conn, user['username'], "DELETE_FORECAST", f"Deleted forecast run ID {run_id}")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/forecast/runs/{run_id}/rename")
async def rename_forecast_run(run_id: int, name: str = Body(..., embed=True), user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE forecast_runs SET name = :n WHERE id = :id"), {"n": name, "id": run_id})
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bundler/runs")
async def get_bundler_runs(dataset_id: int = None, user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            query = "SELECT id, name, dataset_id, forecast_run_id, created_at, status FROM bundler_runs"
            params = {}
            if dataset_id:
                query += " WHERE dataset_id = :dataset_id"
                params["dataset_id"] = dataset_id
            query += " ORDER BY id DESC"
            res = conn.execute(text(query), params).fetchall()
            
            runs = []
            for r in res:
                runs.append({
                    "id": r[0],
                    "name": r[1],
                    "dataset_id": r[2],
                    "forecast_run_id": r[3],
                    "created_at": r[4],
                    "status": r[5]
                })
            return {"runs": runs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/datasets/{dataset_id}/bundler-runs")
async def get_dataset_bundler_runs(dataset_id: int, user=Depends(get_current_user)):
    """Fetch bundler runs for a specific dataset"""
    try:
        with engine.connect() as conn:
            query = "SELECT id, name, dataset_id, forecast_run_id, created_at, status FROM bundler_runs WHERE dataset_id = :d ORDER BY id DESC"
            res = conn.execute(text(query), {"d": dataset_id}).fetchall()
            
            runs = []
            for r in res:
                runs.append({
                    "id": r[0],
                    "name": r[1],
                    "dataset_id": r[2],
                    "forecast_run_id": r[3],
                    "created_at": r[4],
                    "status": r[5]
                })
            return {"runs": runs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bundler/runs/{run_id}")
async def get_bundler_run_details(run_id: int, user=Depends(get_current_user)):
    try:
        with engine.connect() as conn:
            res = conn.execute(
                text("SELECT bundle_pair, result_json FROM bundler_results WHERE run_id = :rid"),
                {"rid": run_id}
            ).fetchall()
            
            bundles = []
            for pair, rj in res:
                bundles.append(json.loads(rj))
            
            return {"bundles": bundles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/bundler/runs/{run_id}/rename")
async def rename_bundler_run(run_id: int, name: str = Body(..., embed=True), user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE bundler_runs SET name = :n WHERE id = :id"), {"n": name, "id": run_id})
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/bundler/runs/{run_id}/rename")
async def rename_bundler_run(run_id: int, name: str = Body(..., embed=True), user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE bundler_runs SET name = :n WHERE id = :id"), {"n": name, "id": run_id})
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/bundler/runs/{run_id}")
async def delete_bundler_run(run_id: int, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM bundler_runs WHERE id = :id"), {"id": run_id})
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bundler/generate")
async def get_strategic_bundles(dataset_id: int, run_id: int, user=Depends(get_current_user)):
    try:
        # Pass the global 'engine' to the bundler
        bundles = generate_strategic_bundles(engine, dataset_id, run_id)
        return {"bundles": bundles}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/datasets/{dataset_id}")
async def delete_dataset(dataset_id: int, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            # Delete in order of dependencies
            conn.execute(text("DELETE FROM sales_transactions WHERE dataset_id = :id"), {"id": dataset_id})
            conn.execute(text("DELETE FROM aggregated_sales WHERE dataset_id = :id"), {"id": dataset_id})
            conn.execute(text("DELETE FROM item_metadata WHERE dataset_id = :id"), {"id": dataset_id})
            
            # Delete associated runs and results
            conn.execute(text("DELETE FROM forecast_results WHERE run_id IN (SELECT id FROM forecast_runs WHERE dataset_id = :id)"), {"id": dataset_id})
            conn.execute(text("DELETE FROM forecast_runs WHERE dataset_id = :id"), {"id": dataset_id})
            
            conn.execute(text("DELETE FROM bundler_results WHERE run_id IN (SELECT id FROM bundler_runs WHERE dataset_id = :id)"), {"id": dataset_id})
            conn.execute(text("DELETE FROM bundler_runs WHERE dataset_id = :id"), {"id": dataset_id})
            
            # Finally delete the dataset record
            conn.execute(text("DELETE FROM datasets WHERE id = :id"), {"id": dataset_id})
            
            log_audit(conn, user['username'], "DELETE_DATASET", f"Permanently deleted dataset ID {dataset_id}")
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bundler/preview")
async def get_bundler_preview(dataset_id: int, min_support: float = 0.01, ref_forecast_id: Optional[Union[int, str]] = "none", user=Depends(get_current_user)):
    try:
        # Resolve reference
        ref_id = None
        if ref_forecast_id != "none" and ref_forecast_id != "auto":
            ref_id = int(ref_forecast_id)
            
        bundles = generate_strategic_bundles(
            engine, dataset_id, 
            bundler_run_id=None, 
            forecast_run_id=ref_id, 
            min_support=min_support
        )
        return {"bundles": bundles}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bundler/runs/commit")
async def commit_bundler_run(req: CommitBundlerRequest, user=Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        with engine.connect() as conn:
            now = (datetime.datetime.utcnow().isoformat() + "Z")
            
            # Clean up ref_id
            ref_id = None
            if req.forecast_ref_id not in [None, "none", "auto", ""]:
                try:
                    ref_id = int(req.forecast_ref_id)
                except (ValueError, TypeError):
                    ref_id = None

            run_id = _insert_and_get_id(
                conn,
                "INSERT INTO bundler_runs (dataset_id, name, created_at, forecast_run_id) VALUES (:d, :n, :t, :f)",
                {"d": req.dataset_id, "n": req.name, "t": now, "f": ref_id}
            )
            
            for b in req.bundles:
                conn.execute(
                    text("INSERT INTO bundler_results (run_id, bundle_pair, result_json) VALUES (:rid, :pair, :rj)"),
                    {"rid": run_id, "pair": b['pair'], "rj": json.dumps(b)}
                )
            log_audit(conn, user['username'], "COMMIT_BUNDLER", f"Officially saved bundling run '{req.name}' (ID: {run_id})")
            conn.commit()
        return {"status": "success", "run_id": run_id}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bundler/simulate")
async def simulate_bundle(req: dict, user=Depends(get_current_user)):
    """
    Evaluates a specific manual pairing against historical and forecast data.
    """
    try:
        dataset_ids = req.get("dataset_ids") # Expecting list
        if not dataset_ids:
            did = req.get("dataset_id") or _get_active_dataset_id()
            dataset_ids = [did] if did else []

        item_a = req.get("item_a")
        item_b = req.get("item_b")
        ref_id = req.get("ref_forecast_id")
        
        if not dataset_ids:
            raise HTTPException(status_code=400, detail="No datasets selected for simulation")

        # Clean up ref_id
        if ref_id in ["none", "auto", ""]:
            ref_id = None
        elif ref_id:
            try:
                ref_id = int(ref_id)
            except:
                ref_id = None

        if not item_a or not item_b:
            raise HTTPException(status_code=400, detail="Two items required for simulation")

        result = score_single_pair(engine, dataset_ids, item_a, item_b, ref_id)
        
        return {"result": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
