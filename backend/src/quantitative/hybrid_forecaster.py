import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
from sqlalchemy import create_engine, text
import warnings

# Suppress optimization warnings for a cleaner terminal
warnings.filterwarnings("ignore")

def preprocess_and_forecast_item(item_df, forecast_end):
    """
    Standardizes the raw transaction data and calculates the required 
    forecast horizon based on the user's selected end date.
    """
    item_df['order_date'] = pd.to_datetime(item_df['order_date'])
    daily_df = item_df.groupby('order_date')['quantity'].sum().reset_index()
    
    prophet_df = daily_df.rename(columns={'order_date': 'ds', 'quantity': 'y'})
    
    latest_data_date = prophet_df['ds'].max()
    user_end_dt = pd.to_datetime(forecast_end)
    
    total_days = (user_end_dt - latest_data_date).days
    
    if total_days <= 0:
        return pd.DataFrame() 

    return _run_optima_specialist_logic(prophet_df, total_days, latest_data_date, user_end_dt)


def _run_optima_specialist_logic(df, forecast_days, latest_date, end_date):
    """
    The Pure-Database Hybrid Specialist:
    Only acknowledges special days (Holidays/Promos) that exist in the
    local optima.db 'custom_events' table.
    """
    
    # --- STAGE 1: UNIFIED CALENDAR RETRIEVAL ---
    # We fetch ALL events (Seeded PH Holidays + User Custom Promos)
    db_engine = create_engine("sqlite:///./optima.db")
    unified_holidays_df = pd.DataFrame()
    
    try:
        with db_engine.connect() as conn:
            # Query the unified table
            res = conn.execute(text("SELECT event_name as holiday, event_date as ds FROM custom_events")).fetchall()
            if res:
                unified_holidays_df = pd.DataFrame(res, columns=['holiday', 'ds'])
                unified_holidays_df['ds'] = pd.to_datetime(unified_holidays_df['ds'])
                # lower_window=0 (day of), upper_window=1 (next day spillover)
                unified_holidays_df['lower_window'] = 0
                unified_holidays_df['upper_window'] = 1 
    except Exception as e:
        print(f"Calendar Fetch Warning: {e}")

    # --- STAGE 2: PROPHET (Macro Specialist) ---
    # The model now only reacts to the database-driven holiday dataframe
    model_p = Prophet(
        daily_seasonality=True, 
        yearly_seasonality=True,
        holidays=unified_holidays_df if not unified_holidays_df.empty else None
    )
    # We NO LONGER call add_country_holidays('PH') here because the DB handles it.
    model_p.fit(df)
    
    future = model_p.make_future_dataframe(periods=forecast_days)
    forecast_p = model_p.predict(future)
    
    prophet_historical_fit = forecast_p.iloc[:len(df)]['yhat'].values
    residuals = df['y'].values - prophet_historical_fit

    # --- STAGE 3: SARIMA (Pattern Specialist) ---
    try:
        model_s = SARIMAX(residuals, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7))
        res_s = model_s.fit(disp=False)
        sarima_correction = res_s.get_forecast(steps=forecast_days).predicted_mean
        sarima_historical_fit = res_s.fittedvalues
    except Exception:
        sarima_correction = np.zeros(forecast_days)
        sarima_historical_fit = np.zeros(len(df))

    # --- STAGE 4: ACCURACY AUDIT ---
    combined_historical_fit = prophet_historical_fit + sarima_historical_fit
    y_true = df['y'].values
    y_pred = combined_historical_fit
    
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = mean_absolute_percentage_error(y_true + 1, y_pred + 1) 
    accuracy_score = max(0, (1 - mape) * 100)

    # --- STAGE 5: UI AUDIT MASKING ---
    future_slice = forecast_p.tail(forecast_days).copy()
    prophet_future = future_slice['yhat'].values
    final_combined = prophet_future + sarima_correction

    # Create a quick set for fast lookup in the UI list
    db_event_dates = set(unified_holidays_df['ds'].dt.strftime('%Y-%m-%d')) if not unified_holidays_df.empty else set()

    special_days_mask = []
    for d in future_slice['ds']:
        date_str = d.strftime('%Y-%m-%d')
        # If it's in our DB, mark it as 1 for the UI Specialist Audit
        if date_str in db_event_dates:
            special_days_mask.append(1)
        else:
            special_days_mask.append(0)

    # --- STAGE 6: DATA SYNTHESIS ---
    forecast_dates = future_slice['ds'].dt.strftime('%Y-%m-%d').values
    
    result_df = pd.DataFrame({
        'forecast_date': forecast_dates,
        'predicted_quantity': np.maximum(0, final_combined).round(0),
        'prophet_trend': prophet_future.round(2),
        'sarima_pattern_correction': sarima_correction.round(2),
        'special_day_detected': special_days_mask
    })

    result_df.attrs['metrics'] = {
        'mae': round(float(mae), 4),
        'rmse': round(float(rmse), 4),
        'mape_pct': f"{round(float(accuracy_score), 2)}%"
    }

    return result_df