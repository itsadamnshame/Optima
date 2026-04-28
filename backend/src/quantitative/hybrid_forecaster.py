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
    The Pure-Database Hybrid Specialist with Two-Pass Holdout Validation.
    Pass 1 measures true out-of-sample accuracy on a dynamic holdout set.
    Pass 2 trains on 100% of data to maximize future prediction accuracy.
    """
    
    # --- STAGE 1: UNIFIED CALENDAR RETRIEVAL ---
    db_engine = create_engine("sqlite:///./optima.db")
    unified_holidays_df = pd.DataFrame()
    
    try:
        with db_engine.connect() as conn:
            res = conn.execute(text("SELECT event_name as holiday, event_date as ds FROM custom_events")).fetchall()
            if res:
                unified_holidays_df = pd.DataFrame(res, columns=['holiday', 'ds'])
                unified_holidays_df['ds'] = pd.to_datetime(unified_holidays_df['ds'])
                unified_holidays_df['lower_window'] = 0
                unified_holidays_df['upper_window'] = 1 
    except Exception as e:
        print(f"Calendar Fetch Warning: {e}")

    prophet_kwargs = {
        'daily_seasonality': True,
        'yearly_seasonality': True,
        'holidays': unified_holidays_df if not unified_holidays_df.empty else None
    }

    # --- STAGE 2: PASS 1 - HOLDOUT VALIDATION (Dynamic Bounded Split) ---
    if len(df) > 30:
        # Dynamic holdout: match user's requested forecast horizon, but clamp it between 30 and 90 days.
        target_test_size = forecast_days
        test_size = max(30, min(target_test_size, 90))
        
        # Absolute safety net: never hold out more than 20% of the dataset
        max_allowed_by_data = int(len(df) * 0.2)
        test_size = min(test_size, max_allowed_by_data)
        
        # Ensure test_size is at least 1 (in edge case where dataset is exactly 30 days)
        test_size = max(1, test_size)

        train_df = df.iloc[:-test_size].copy()
        test_df = df.iloc[-test_size:].copy()

        # Validation Prophet
        val_model_p = Prophet(**prophet_kwargs)
        val_model_p.fit(train_df)
        
        val_future = val_model_p.make_future_dataframe(periods=test_size)
        val_forecast_p = val_model_p.predict(val_future)
        
        val_prophet_train_fit = val_forecast_p.iloc[:len(train_df)]['yhat'].values
        val_residuals = train_df['y'].values - val_prophet_train_fit

        # Validation SARIMA
        try:
            val_model_s = SARIMAX(val_residuals, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7))
            val_res_s = val_model_s.fit(disp=False)
            val_sarima_test_correction = val_res_s.get_forecast(steps=test_size).predicted_mean
        except Exception:
            val_sarima_test_correction = np.zeros(test_size)

        # Out-Of-Sample Metrics
        val_prophet_test_fit = val_forecast_p.iloc[-test_size:]['yhat'].values
        val_combined_test_pred = val_prophet_test_fit + val_sarima_test_correction
        
        y_true_test = test_df['y'].values
        y_pred_test = np.maximum(0, val_combined_test_pred)
        
        mae = mean_absolute_error(y_true_test, y_pred_test)
        rmse = np.sqrt(mean_squared_error(y_true_test, y_pred_test))
        mape = mean_absolute_percentage_error(y_true_test + 1, y_pred_test + 1)
        accuracy_score = max(0, (1 - mape) * 100)
    else:
        mae, rmse, mape, accuracy_score = 0.0, 0.0, 0.0, 0.0

    # --- STAGE 3: PASS 2 - FULL FORECAST (100% Data) ---
    model_p = Prophet(**prophet_kwargs)
    model_p.fit(df)
    
    future = model_p.make_future_dataframe(periods=forecast_days)
    forecast_p = model_p.predict(future)
    
    prophet_historical_fit = forecast_p.iloc[:len(df)]['yhat'].values
    residuals = df['y'].values - prophet_historical_fit

    try:
        model_s = SARIMAX(residuals, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7))
        res_s = model_s.fit(disp=False)
        sarima_correction = res_s.get_forecast(steps=forecast_days).predicted_mean
    except Exception:
        sarima_correction = np.zeros(forecast_days)

    # --- STAGE 4: UI AUDIT MASKING ---
    future_slice = forecast_p.tail(forecast_days).copy()
    prophet_future = future_slice['yhat'].values
    final_combined = prophet_future + sarima_correction

    db_event_dates = set(unified_holidays_df['ds'].dt.strftime('%Y-%m-%d')) if not unified_holidays_df.empty else set()
    special_days_mask = [1 if d.strftime('%Y-%m-%d') in db_event_dates else 0 for d in future_slice['ds']]

    # --- STAGE 5: DATA SYNTHESIS ---
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