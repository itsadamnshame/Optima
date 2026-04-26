import asyncio
import pandas as pd
import io
import traceback
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine

# ==========================================
# CUSTOM MODULE IMPORTS
# ==========================================
from src.quantitative.time_preprocessor import prepare_time_series
from src.quantitative.prophet_model import run_prophet_forecast
from src.qualitative.apriori_model import create_cart_matrix, generate_bundle_rules
from src.decision.rule_engine import generate_recommendations

# ==========================================
# SERVER & DATABASE INITIALIZATION
# ==========================================
app = FastAPI(title="OPTIMA Engine API - Final Thesis Build")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite Persistence - Creates 'optima.db'
DATABASE_URL = "sqlite:///./optima.db"
engine = create_engine(DATABASE_URL)

storage_path = Path("backend_storage")
storage_path.mkdir(exist_ok=True)

# ==========================================
# MODULE 1: PERSISTENT DATA INGESTION
# ==========================================
@app.post("/api/upload-data")
async def process_sales_data(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        if file.filename.endswith('.xlsx'):
            excel_data = pd.read_excel(io.BytesIO(contents), sheet_name=None)
            sales_df = pd.concat(excel_data.values(), ignore_index=True)
        else:
            sales_df = pd.read_csv(io.BytesIO(contents))

        # Standardize Columns
        sales_df.columns = (sales_df.columns.str.strip().str.lower()
                            .str.replace(' ', '_').str.replace(r'\(|\)', '', regex=True))

        sales_df = sales_df.rename(columns={
            'orderdate': 'order_date', 
            'itemdescription': 'item_description', 
            'customerid': 'customer_id', 
            'orderid': 'order_id'
        })

        # Standardize Types
        sales_df['order_date'] = pd.to_datetime(sales_df['order_date'], dayfirst=True, errors='coerce')
        sales_df['quantity'] = pd.to_numeric(sales_df['quantity'], errors='coerce')
        sales_df['total'] = pd.to_numeric(sales_df['total'], errors='coerce')

        valid_sales = sales_df[(sales_df['quantity'] > 0) & (sales_df['total'] >= 0)].dropna(
            subset=['item_description', 'order_id', 'order_date']
        ).copy()

        # PERSISTENCE
        valid_sales.to_csv(storage_path / "base_cleaned_sales.csv", index=False)
        valid_sales.to_sql("sales_transactions", engine, if_exists="replace", index=False)

        return {"status": "success", "total_rows_processed": len(valid_sales)}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ingestion Error: {str(e)}")

# ==========================================
# MODULES 2-4: THE OPTIMA MASTER PIPELINE
# ==========================================
@app.get("/api/generate-recommendations")
async def trigger_optima_pipeline():
    try:
        # PULL FROM SQL
        raw_df = pd.read_sql("SELECT * FROM sales_transactions", engine)
        raw_df['order_date'] = pd.to_datetime(raw_df['order_date'])

        # --- BRANCH A: QUANTITATIVE ---
        def run_quantitative_branch():
            weekly_data = prepare_time_series(raw_df, freq='W')
            top_items = weekly_data['item_description'].value_counts().head(5).index
            all_forecasts = []
            top_item_metrics = None 
            
            for index, item in enumerate(top_items):
                item_history = weekly_data[weekly_data['item_description'] == item]
                forecast, metrics = run_prophet_forecast(item_history, item_name=item, periods=4) 
                all_forecasts.append(forecast)
                if index == 0: 
                    # Convert NumPy floats to Python floats for JSON compatibility
                    top_item_metrics = {k: float(v) if hasattr(v, 'item') else v for k, v in metrics.items()}
                
            combined = pd.concat(all_forecasts, ignore_index=True)
            combined['forecast_date'] = combined['forecast_date'].astype(str)
            return combined, top_item_metrics

        # --- BRANCH B: QUALITATIVE (Random Forest Integrated) ---
        def run_qualitative_branch():
            cart_matrix = create_cart_matrix(raw_df)
            return generate_bundle_rules(cart_matrix, min_support=0.01)

        # EXECUTE IN PARALLEL
        print("OPTIMA: Executing parallel AI branches...")
        (forecast_df, top_item_metrics), rules_df = await asyncio.gather(
            asyncio.to_thread(run_quantitative_branch),
            asyncio.to_thread(run_qualitative_branch)
        )

        # SAVE RESULTS TO SQL
        forecast_df.to_sql("forecast_results", engine, if_exists="replace", index=False)
        rules_df.to_sql("strategic_bundles", engine, if_exists="replace", index=False)

        # SEQUENTIAL MERGE: Decision Engine
        print("Initializing Decision Engine...")
        
        # SAFE CHECK: Ensure Decision Engine handles the column names 'antecedents'
        final_advice = []
        if not rules_df.empty:
            final_advice = generate_recommendations(forecast_df, rules_df)

        return {
            "status": "success",
            "recommendations": final_advice,
            "bundles": rules_df.to_dict(orient="records"),
            "chart_data": forecast_df.to_dict(orient="records"),
            "model_metrics": top_item_metrics 
        }

    except Exception as e:
        print("!!! PIPELINE CRASHED !!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline Error: {str(e)}")

# ==========================================
# MODULE 5: ANALYTICAL HISTORY
# ==========================================
@app.get("/api/history")
async def get_historical_analysis():
    try:
        bundles = pd.read_sql("SELECT * FROM strategic_bundles ORDER BY success_probability DESC", engine)
        return {"status": "success", "history": bundles.to_dict(orient="records")}
    except:
        return {"status": "error", "message": "No history found."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)