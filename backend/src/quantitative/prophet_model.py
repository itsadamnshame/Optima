import pandas as pd
import numpy as np
from prophet import Prophet
import warnings

warnings.filterwarnings("ignore")

def run_prophet_forecast(item_df: pd.DataFrame, item_name: str, periods: int = 12, freq: str = 'W'):
    print(f"Training Prophet model for: {item_name}...")
    
    prophet_df = item_df[['order_date', 'quantity']].copy()
    prophet_df = prophet_df.rename(columns={'order_date': 'ds', 'quantity': 'y'})
    
    model = Prophet(
        yearly_seasonality=True, 
        weekly_seasonality=False, 
        daily_seasonality=False,
        changepoint_prior_scale=0.01,  
        seasonality_prior_scale=1.0    
    )
    model.fit(prophet_df)
    
    future_dates = model.make_future_dataframe(periods=periods, freq=freq)
    forecast = model.predict(future_dates)
    
    # ---------------------------------------------------------
    # MULTI-METRIC ENGINE
    # ---------------------------------------------------------
    historical_eval = forecast[['ds', 'yhat']].merge(prophet_df[['ds', 'y']], on='ds', how='inner')
    
    metrics = {
        "WAPE": 0.0,
        "MAE": 0.0,
        "MAPE": "Incompatible", 
        "mape_warning": False
    }
    
    if not historical_eval.empty:
        actuals = historical_eval['y']
        predictions = historical_eval['yhat']
        
        # 1. MAE (Mean Absolute Error) - Absolute unit difference
        metrics["MAE"] = round(np.mean(np.abs(actuals - predictions)), 1)
        
        # 2. WAPE (Retail Standard)
        if actuals.sum() > 0:
            metrics["WAPE"] = round((np.sum(np.abs(actuals - predictions)) / np.sum(actuals)) * 100, 2)
            
        # 3. MAPE (The volatile one)
        # We only calculate it if there are NO zeros, and if the volume is high enough
        if (actuals == 0).any() or actuals.mean() < 10:
            metrics["mape_warning"] = True
            metrics["MAPE"] = "N/A (Intermittent Data)"
        else:
            mape_val = np.mean(np.abs((actuals - predictions) / actuals)) * 100
            if mape_val > 100:
                metrics["mape_warning"] = True
                metrics["MAPE"] = f">100% (High Variance)"
            else:
                metrics["MAPE"] = f"{round(mape_val, 2)}%"

    # Clean up forecast dataframe
    future_forecast = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods).copy()
    future_forecast = future_forecast.rename(columns={
        'ds': 'forecast_date',
        'yhat': 'predicted_quantity',
        'yhat_lower': 'worst_case_quantity',
        'yhat_upper': 'best_case_quantity'
    })
    
    future_forecast['item_description'] = item_name
    for col in ['predicted_quantity', 'worst_case_quantity', 'best_case_quantity']:
        future_forecast[col] = future_forecast[col].clip(lower=0).round()
        
    return future_forecast, metrics