import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
from pathlib import Path

# ==========================================
# CUSTOM MODULE IMPORTS
# ==========================================
from src.quantitative.time_preprocessor import prepare_time_series
from src.quantitative.prophet_model import run_prophet_forecast
from src.qualitative.apriori_model import create_cart_matrix, generate_bundle_rules
from src.decision.rule_engine import generate_recommendations

# ==========================================
# SERVER INITIALIZATION
# ==========================================
app = FastAPI(title="OPTIMA Engine API")

# Allow the frontend dashboard to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this to your Vercel URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the storage directory exists on the server
storage_path = Path("backend_storage")
storage_path.mkdir(exist_ok=True)

# ==========================================
# MODULE 1: DATA INGESTION API
# ==========================================
@app.post("/api/upload-data")
async def process_sales_data(file: UploadFile = File(...)):
    """
    Receives an Excel or CSV file, cleans it, and prepares it for the models.
    """
    if not file.filename.endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are allowed.")

    try:
        contents = await file.read()
        dfs = []

        # Dynamically read all sheets if it is an Excel file
        if file.filename.endswith('.xlsx'):
            excel_data = pd.read_excel(io.BytesIO(contents), sheet_name=None)
            for sheet_name, df in excel_data.items():
                dfs.append(df)
        else:
            df = pd.read_csv(io.BytesIO(contents))
            dfs.append(df)

        sales_df = pd.concat(dfs, ignore_index=True)

        # Standardize Column Names
        sales_df.columns = (sales_df.columns
                            .str.strip().str.lower()
                            .str.replace(' ', '_')
                            .str.replace(r'\(|\)', '', regex=True))

        sales_df = sales_df.rename(columns={
            'orderdate': 'order_date', 
            'itemdescription': 'item_description', 
            'customerid': 'customer_id', 
            'orderid': 'order_id'
        })

        # Standardize Data Types
        sales_df['order_date'] = pd.to_datetime(sales_df['order_date'], dayfirst=True, errors='coerce')
        sales_df['quantity'] = pd.to_numeric(sales_df['quantity'], errors='coerce')
        sales_df['total'] = pd.to_numeric(sales_df['total'], errors='coerce')

        # Anomaly and Return Filtering (No ghost transactions)
        valid_sales = sales_df[(sales_df['quantity'] > 0) & (sales_df['total'] >= 0)].copy()
        valid_sales = valid_sales.dropna(subset=['item_description', 'order_id', 'order_date'])

        # Save to backend storage for the mathematical models to use
        valid_sales.to_csv(storage_path / "base_cleaned_sales.csv", index=False)

        return {
            "status": "success",
            "message": "Data successfully ingested and cleaned.",
            "total_rows_processed": len(valid_sales),
            "date_range": f"{valid_sales['order_date'].min().date()} to {valid_sales['order_date'].max().date()}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# ==========================================
# MODULES 2-4: THE OPTIMA MASTER PIPELINE
# ==========================================
@app.get("/api/generate-recommendations")
async def trigger_optima_pipeline():
    """
    The master trigger. Runs the Quantitative and Qualitative engines in parallel,
    then feeds them into the Decision Engine.
    """
    file_path = storage_path / "base_cleaned_sales.csv"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="No cleaned data found. Please upload a dataset first.")

    try:
        # 1. SEQUENTIAL START: Load the clean data into memory
        print("Starting OPTIMA Pipeline...")
        raw_df = pd.read_csv(file_path)

        # ---------------------------------------------------------
        # DEFINING THE PARALLEL TASKS
        # ---------------------------------------------------------
        def run_quantitative_branch():
            """Runs Prophet time-series forecasting."""
            weekly_data = prepare_time_series(raw_df, freq='W')
            top_items = weekly_data['item_description'].value_counts().head(5).index
            
            all_forecasts = []
            top_item_metrics = None # We will capture the metrics for the #1 item here
            
            for index, item in enumerate(top_items):
                item_history = weekly_data[weekly_data['item_description'] == item]
                
                # Catch both the forecast dataframe AND the metrics dictionary
                forecast, metrics = run_prophet_forecast(item_history, item_name=item, periods=4) 
                
                all_forecasts.append(forecast)
                
                # Save the metrics of the #1 selling item for the dashboard
                if index == 0:
                    top_item_metrics = metrics
                
            combined_forecasts = pd.concat(all_forecasts, ignore_index=True)
            combined_forecasts['forecast_date'] = combined_forecasts['forecast_date'].astype(str)
            
            return combined_forecasts, top_item_metrics

        def run_qualitative_branch():
            """Runs Apriori association mapping."""
            cart_matrix = create_cart_matrix(raw_df)
            return generate_bundle_rules(cart_matrix, min_support=0.01)

        # 2. PARALLEL PROCESSING: Execute math branches simultaneously
        print("Executing AI branches in parallel...")
        
        # Unpack the forecast dataframe and our new metrics dictionary
        (forecast_df, top_item_metrics), rules_df = await asyncio.gather(
            asyncio.to_thread(run_quantitative_branch),
            asyncio.to_thread(run_qualitative_branch)
        )

        # 3. SEQUENTIAL MERGE: Run the logical Playbook
        print("Merging outputs into Decision Engine...")
        final_advice = generate_recommendations(forecast_df, rules_df)

        # Send EVERYTHING back to React
        return {
            "status": "success",
            "message": "OPTIMA pipeline execution complete.",
            "recommendations": final_advice,
            "chart_data": forecast_df.to_dict(orient="records"),
            "model_metrics": top_item_metrics # THE FIX: Sending the dictionary to the UI
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline Error: {str(e)}")