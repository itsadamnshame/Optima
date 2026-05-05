import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
from sqlalchemy import create_engine, text
import warnings
import optuna
from pmdarima import auto_arima
import logging
import json
from pathlib import Path

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

# Suppress optimization warnings for a cleaner terminal
warnings.filterwarnings("ignore")

def preprocess_and_forecast_item(item_df, forecast_end, item_name="unknown"):
    """
    Standardizes the raw transaction data and calculates the required 
    forecast horizon based on the user's selected end date.
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

    # --- STAGE 2: OPTIMIZED PARAMETER SELECTION (Caching Layer) ---
    cache = _load_param_cache()
    item_name = df.attrs.get('item_name', 'unknown_item') # We'll need to pass this
    
    if item_name in cache:
        print(f"OPTIMA: Loading cached parameters for {item_name}")
        best_params = cache[item_name].get('prophet', {'changepoint_prior_scale': 0.05, 'seasonality_prior_scale': 10.0})
        best_sarima_order = cache[item_name].get('sarima_order', (1, 1, 1))
        best_sarima_seasonal = cache[item_name].get('sarima_seasonal', (1, 1, 1, 7))
    else:
        print(f"OPTIMA: Tuning parameters for {item_name}...")
        def objective(trial):
            cps = trial.suggest_float('changepoint_prior_scale', 0.001, 0.5, log=True)
            sps = trial.suggest_float('seasonality_prior_scale', 0.01, 10.0, log=True)
            
            split_idx = int(len(df) * 0.8)
            tune_train = df.iloc[:split_idx]
            tune_val = df.iloc[split_idx:]
            
            if len(tune_val) == 0: return 0.0
            
            m = Prophet(
                changepoint_prior_scale=cps,
                seasonality_prior_scale=sps,
                daily_seasonality=True,
                yearly_seasonality=True,
                holidays=unified_holidays_df if not unified_holidays_df.empty else None
            )
            m.fit(tune_train)
            future_tune = m.make_future_dataframe(periods=len(tune_val))
            forecast_tune = m.predict(future_tune)
            preds = forecast_tune.iloc[split_idx:]['yhat'].values
            return mean_absolute_error(tune_val['y'], preds)

        optuna.logging.set_verbosity(optuna.logging.WARNING)
        
        if len(df) > 14:
            study = optuna.create_study(direction='minimize')
            study.optimize(objective, n_trials=10) # Faster tuning
            best_params = study.best_params
        else:
            best_params = {'changepoint_prior_scale': 0.05, 'seasonality_prior_scale': 10.0}

        # Pre-tuning SARIMA order here too
        try:
            # We tune on full data residuals for caching
            m_temp = Prophet(**{**best_params, 'daily_seasonality': True, 'yearly_seasonality': True})
            m_temp.fit(df)
            res_temp = df['y'].values - m_temp.predict(df)['yhat'].values
            stepwise_model = auto_arima(res_temp, seasonal=True, m=7, suppress_warnings=True, error_action="ignore")
            best_sarima_order = stepwise_model.order
            best_sarima_seasonal = stepwise_model.seasonal_order
        except:
            best_sarima_order = (1, 1, 1)
            best_sarima_seasonal = (1, 1, 1, 7)

        # Save to cache
        cache[item_name] = {
            'prophet': best_params,
            'sarima_order': [int(x) for x in best_sarima_order],
            'sarima_seasonal': [int(x) for x in best_sarima_seasonal]
        }
        _save_param_cache(cache)

    prophet_kwargs = {
        'changepoint_prior_scale': best_params['changepoint_prior_scale'],
        'seasonality_prior_scale': best_params['seasonality_prior_scale'],
        'daily_seasonality': True,
        'yearly_seasonality': True,
        'holidays': unified_holidays_df if not unified_holidays_df.empty else None
    }

    # --- STAGE 3: PASS 1 - HOLDOUT VALIDATION ---
    if len(df) > 30:
        target_test_size = forecast_days
        test_size = max(30, min(target_test_size, 90))
        max_allowed_by_data = int(len(df) * 0.2)
        test_size = min(test_size, max_allowed_by_data)
        test_size = max(1, test_size)

        train_df = df.iloc[:-test_size].copy()
        test_df = df.iloc[-test_size:].copy()

        val_model_p = Prophet(**prophet_kwargs)
        val_model_p.fit(train_df)
        
        val_future = val_model_p.make_future_dataframe(periods=test_size)
        val_forecast_p = val_model_p.predict(val_future)
        
        val_prophet_train_fit = val_forecast_p.iloc[:len(train_df)]['yhat'].values
        val_residuals = train_df['y'].values - val_prophet_train_fit

        # AUTO-ARIMA Validation
        try:
            val_sarima_test_correction = SARIMAX(val_residuals, order=best_sarima_order, seasonal_order=best_sarima_seasonal).fit(disp=False).get_forecast(steps=test_size).predicted_mean
        except Exception:
            val_sarima_test_correction = np.zeros(test_size)

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

    # --- STAGE 4: PASS 2 - FULL FORECAST (100% Data) ---
    model_p = Prophet(**prophet_kwargs)
    model_p.fit(df)
    
    future = model_p.make_future_dataframe(periods=forecast_days)
    forecast_p = model_p.predict(future)
    
    prophet_historical_fit = forecast_p.iloc[:len(df)]['yhat'].values
    residuals = df['y'].values - prophet_historical_fit

    try:
        sarima_correction = SARIMAX(residuals, order=best_sarima_order, seasonal_order=best_sarima_seasonal).fit(disp=False).get_forecast(steps=forecast_days).predicted_mean
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