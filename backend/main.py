import asyncio
import pandas as pd
import io
import traceback
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, inspect, text
import holidays as ph_holidays_lib

# ==========================================
# CUSTOM MODULE IMPORTS
# ==========================================
from src.quantitative.hybrid_forecaster import preprocess_and_forecast_item
from src.qualitative.bundle_analyzer import create_cart_matrix, generate_bundle_rules
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
async def add_custom_event(data: dict):
    try:
        with engine.connect() as conn:
            conn.execute(
                text("INSERT INTO custom_events (event_name, event_date) VALUES (:name, :date)"),
                {"name": data['name'], "date": data['date']}
            )
            conn.commit()
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=400, detail="An event already exists on this date.")

@app.delete("/api/delete-event/{event_date}")
async def delete_custom_event(event_date: str):
    try:
        with engine.connect() as conn:
            conn.execute(
                text("DELETE FROM custom_events WHERE event_date = :date"),
                {"date": event_date}
            )
            conn.commit()
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
# DATA INGESTION
# ==========================================
@app.post("/api/upload-data")
async def process_sales_data(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents)) if file.filename.endswith('.xlsx') else pd.read_csv(io.BytesIO(contents))
        
        df.columns = (df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace(r'\(|\)', '', regex=True))
        df = df.rename(columns={'orderdate': 'order_date', 'itemdescription': 'item_description', 'customerid': 'customer_id', 'orderid': 'order_id'})
        
        df['order_date'] = pd.to_datetime(df['order_date'], dayfirst=True, errors='coerce')
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
        
        valid_sales = df.dropna(subset=['item_description', 'order_id', 'order_date']).copy()
        valid_sales.to_sql("sales_transactions", engine, if_exists="replace", index=False)
        return {"status": "success", "total_rows": len(valid_sales)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# OPTIMA HYBRID PIPELINE
# ==========================================
@app.get("/api/generate-recommendations")
async def trigger_optima_pipeline(
    end_date: str = Query(...),
    mode: str = Query("top"),
    top_n: int = Query(5),
    selected_items: str = Query(None)
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
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)