import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sqlalchemy import create_engine, text
import warnings
import logging
import json
from pathlib import Path
import os
import time

# Silence Prophet and cmdstanpy to keep logs clean
logging.getLogger('prophet').setLevel(logging.ERROR)
logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
logging.getLogger('optuna').setLevel(logging.WARNING)

# Path to persistent parameter storage
STORAGE_DIR = Path(__file__).parent.parent.parent / "backend_storage"
PARAM_CACHE_PATH = STORAGE_DIR / "model_parameters_cache.json"

def _load_param_cache():
    if PARAM_CACHE_PATH.exists():
        try:
            with open(PARAM_CACHE_PATH, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def _save_param_cache(cache):
    try:
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        with open(PARAM_CACHE_PATH, 'w') as f:
            json.dump(cache, f, indent=4)
    except Exception as e:
        print(f"Cache Save Error: {e}")

# Global parameter cache for dataset-level optimization
_global_param_cache = {}

def _get_global_params(dataset_id, df_length):
    """Get globally optimized parameters for the entire dataset."""
    cache_key = f"dataset_{dataset_id}"

    if cache_key in _global_param_cache:
        print(f"OPTIMA: Using globally cached parameters for dataset {dataset_id}")
        return _global_param_cache[cache_key]

    # Use Prophet's optimized defaults instead of tuning
    print(f"OPTIMA: Using Prophet optimized defaults for dataset {dataset_id}")

    # Prophet's recommended defaults for retail forecasting
    prophet_defaults = {
        'changepoint_prior_scale': 0.05,     # Balanced flexibility
        'seasonality_prior_scale': 10.0,     # Strong seasonal patterns
        'daily_seasonality': False,          # Not needed for daily aggregated data
        'yearly_seasonality': df_length > 365,
        'weekly_seasonality': df_length > 21,
        'interval_width': 0.80,              # 80% confidence intervals
        'uncertainty_samples': 0,            # Skip expensive uncertainty sampling
        'n_changepoints': min(8, max(1, int(df_length / 28))),
        'seasonality_mode': 'additive',      # Additive for retail sales
        'stan_backend': 'CMDSTANPY'          # Use cmdstanpy backend for faster execution
    }

    # SARIMA defaults for residual correction
    sarima_defaults = {
        'order': (1, 1, 1),
        'seasonal_order': (1, 1, 1, 7)  # Weekly seasonality
    }

    global_params = {
        'prophet': prophet_defaults,
        'sarima': sarima_defaults
    }

    _global_param_cache[cache_key] = global_params
    return global_params

# Suppress optimization warnings for a cleaner terminal
warnings.filterwarnings("ignore")

def preprocess_and_forecast_item(item_df, forecast_end, item_name="unknown", dataset_id=None):
    """
    Optimized forecasting with global parameter caching and no per-item tuning.
    """
    item_df['order_date'] = pd.to_datetime(item_df['order_date'])
    daily_df = item_df.groupby('order_date')['quantity'].sum().reset_index()

    prophet_df = daily_df.rename(columns={'order_date': 'ds', 'quantity': 'y'})
    prophet_df.attrs['item_name'] = item_name

    latest_data_date = prophet_df['ds'].max()
    user_end_dt = pd.to_datetime(forecast_end)

    total_days = (user_end_dt - latest_data_date).days

    if total_days <= 0:
        return pd.DataFrame()

    return _run_optimized_forecast_logic(prophet_df, total_days, latest_data_date, user_end_dt, dataset_id, item_name)


def _run_optimized_forecast_logic(df, forecast_days, latest_date, end_date, dataset_id, item_name):
    """
    Optimized forecasting logic with global parameters and no holdout validation.
    """
    print(f"OPTIMA: Forecasting {item_name} with optimized parameters...")

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

    # --- STAGE 2: GLOBAL PARAMETER LOADING (No per-item tuning) ---
    global_params = _get_global_params(dataset_id, len(df))
    prophet_kwargs = global_params['prophet'].copy()
    prophet_kwargs['holidays'] = unified_holidays_df if not unified_holidays_df.empty else None

    sarima_order = global_params['sarima']['order']
    sarima_seasonal = global_params['sarima']['seasonal_order']

    # --- STAGE 3: SINGLE-PASS FORECAST (No holdout validation for speed) ---
    print(f"OPTIMA: Running single-pass forecast for {item_name}...")

    # Fit Prophet on full dataset
    model_p = Prophet(**prophet_kwargs)
    for attempt in range(3):
        try:
            model_p.fit(df)
            break
        except Exception as e:
            if attempt == 2:
                print(f"OPTIMA: Prophet fit failed for {item_name}: {e}")
                return pd.DataFrame()
            time.sleep(0.5)

    # Generate forecast
    future = model_p.make_future_dataframe(periods=forecast_days)
    forecast_p = model_p.predict(future)

    # Calculate residuals and apply SARIMA correction
    prophet_historical_fit = forecast_p.iloc[:len(df)]['yhat'].values
    residuals = df['y'].values - prophet_historical_fit

    try:
        sarima_model = SARIMAX(residuals, order=sarima_order, seasonal_order=sarima_seasonal)
        sarima_fit = sarima_model.fit(disp=False)
        sarima_correction = sarima_fit.get_forecast(steps=forecast_days).predicted_mean
    except Exception as e:
        print(f"OPTIMA: SARIMA failed for {item_name}, using Prophet-only: {e}")
        sarima_correction = np.zeros(forecast_days)

    # --- STAGE 4: COMBINE FORECASTS ---
    future_slice = forecast_p.tail(forecast_days).copy()
    prophet_future = future_slice['yhat'].values
    final_combined = prophet_future + sarima_correction

    # Detect special days
    db_event_dates = set(unified_holidays_df['ds'].dt.strftime('%Y-%m-%d')) if not unified_holidays_df.empty else set()
    special_days_mask = [1 if d.strftime('%Y-%m-%d') in db_event_dates else 0 for d in future_slice['ds']]

    # Extract holiday effect
    holiday_effect = future_slice['holidays'].values if 'holidays' in future_slice.columns else np.zeros(len(future_slice))

    # Extract decomposition components
    trend_future = future_slice['trend'].values.round(2)
    weekly_future = future_slice['weekly'].values.round(2) if 'weekly' in future_slice.columns else np.zeros(len(future_slice))
    yearly_future = future_slice['yearly'].values.round(2) if 'yearly' in future_slice.columns else np.zeros(len(future_slice))

    # --- STAGE 5: BUILD OUTPUT DATAFRAME ---
    forecast_dates = future_slice['ds'].dt.strftime('%Y-%m-%d').values

    yhat_lower = future_slice['yhat_lower'].values.round(2) if 'yhat_lower' in future_slice.columns else np.zeros(len(future_slice))
    yhat_upper = future_slice['yhat_upper'].values.round(2) if 'yhat_upper' in future_slice.columns else np.zeros(len(future_slice))

    future_df = pd.DataFrame({
        'forecast_date': forecast_dates,
        'type': 'future',
        'predicted_quantity': np.maximum(0, final_combined).round(0),
        'actual_quantity': None,
        'prophet_trend': prophet_future.round(2),
        'sarima_pattern_correction': sarima_correction.round(2),
        'special_day_detected': special_days_mask,
        'holiday_effect': holiday_effect.round(2),
        'yhat_lower': yhat_lower,
        'yhat_upper': yhat_upper,
        'decomp_trend': trend_future,
        'decomp_weekly': weekly_future,
        'decomp_yearly': yearly_future,
    })

    # Add historical data for context (last 30 days)
    history_days = min(30, len(df))
    if history_days > 0:
        hist_slice = df.tail(history_days).copy()
        hist_forecast_slice = forecast_p.iloc[len(df) - history_days:len(df)].copy()

        hist_trend = hist_forecast_slice['trend'].values.round(2)
        hist_weekly = hist_forecast_slice['weekly'].values.round(2) if 'weekly' in hist_forecast_slice.columns else np.zeros(history_days)
        hist_yearly = hist_forecast_slice['yearly'].values.round(2) if 'yearly' in hist_forecast_slice.columns else np.zeros(history_days)

        hist_df = pd.DataFrame({
            'forecast_date': hist_slice['ds'].dt.strftime('%Y-%m-%d').values,
            'type': 'historical',
            'predicted_quantity': hist_slice['y'].values,
            'actual_quantity': hist_slice['y'].values,
            'prophet_trend': None,
            'sarima_pattern_correction': 0.0,
            'special_day_detected': 0,
            'holiday_effect': 0.0,
            'yhat_lower': None,
            'yhat_upper': None,
            'decomp_trend': hist_trend,
            'decomp_weekly': hist_weekly,
            'decomp_yearly': hist_yearly,
        })
        result_df = pd.concat([hist_df, future_df], ignore_index=True)
    else:
        result_df = future_df

    # Add performance metrics (estimated, no holdout validation)
    result_df.attrs['metrics'] = {
        'mae': 0.0,  # No validation, so no metrics
        'rmse': 0.0,
        'mape_pct': 0.0,
        'accuracy_score': 0.0
    }

    print(f"OPTIMA: Forecast complete for {item_name} ({forecast_days} days)")
    return result_df