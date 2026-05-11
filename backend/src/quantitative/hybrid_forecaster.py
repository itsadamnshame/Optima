import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.seasonal import STL
from pmdarima import auto_arima
import datetime
import warnings

warnings.filterwarnings('ignore')

def aggregate_monthly(df):
    """
    Rolls up daily transactions into a continuous monthly series.
    Ensures missing months are filled with 0.
    Supports both raw transactions (OrderDate/Quantity) and pre-aggregated data (ds/y).
    """
    if df.empty:
        return pd.Series()
    
    # Check if already aggregated
    if 'ds' in df.columns and 'y' in df.columns:
        df = df.copy()
        df['ds'] = pd.to_datetime(df['ds'])
        # Sort and ensure unique index
        df = df.sort_values('ds').drop_duplicates('ds')
        df.set_index('ds', inplace=True)
        monthly = df['y']
    else:
        # 1. Ensure OrderDate is datetime
        df['OrderDate'] = pd.to_datetime(df['OrderDate'])
        
        # 2. Daily roll-up (sum quantity)
        daily = df.groupby('OrderDate')['Quantity'].sum().reset_index()
        daily.set_index('OrderDate', inplace=True)
        
        # 3. Monthly resampling (Month Start)
        monthly = daily['Quantity'].resample('MS').sum()
    
    # 4. Fill gaps (ensure no months are missing between start and end)
    if not monthly.empty:
        full_range = pd.date_range(start=monthly.index.min(), end=monthly.index.max(), freq='MS')
        monthly = monthly.reindex(full_range, fill_value=0)
    
    return monthly

def detect_zombies(monthly_series):
    """
    Uses STL Trend to identify 'Zombie' products (dead or dying).
    Returns True if the trend is effectively zero.
    """
    if len(monthly_series) < 12: # Not enough data for STL seasonal
        return False
        
    try:
        res = STL(monthly_series, period=12).fit()
        # If the last 3 months of trend are near zero and declining
        last_trend = res.trend.iloc[-3:].mean()
        if last_trend < 0.5: # Less than half a unit per month on average
            return True
    except:
        pass
    return False

def preprocess_and_forecast_item(item_df, forecast_end, item_name="unknown", config=None):
    """
    Main entry point for the Hybrid Forecaster (Phase 2).
    
    Args:
        item_df: Transaction data for the item
        forecast_end: End date for forecast
        item_name: Item description/name
        config: Dictionary with keys:
            - type: 'seasonal', 'high_velocity', or 'always'
            - status: 'available' or 'discontinued'
            - bundle_is_set: bool, whether this item is a bundle/set
    """
    if config is None:
        config = {}
    
    availability_type = config.get('type', 'always')
    print(f"OPTIMA: Analyzing {item_name}... [Strategy: {availability_type}]")
    
    # 1. Aggregate
    monthly = aggregate_monthly(item_df)
    
    if len(monthly) < 12:
        print(f"OPTIMA: [{item_name}] Insufficient history ({len(monthly)} months). Skipping specialist model.")
        return pd.DataFrame() # Frontend will handle this as 'too little data'

    # 2. Zombie Check
    if detect_zombies(monthly):
        print(f"OPTIMA: [{item_name}] Flagged as ZOMBIE. Capping forecast at zero.")
        # Return a dummy forecast of zeros
        return generate_dummy_forecast(monthly, forecast_end, item_name, status="zombie")

    # 3. 4-Part STL Decomposition for UI
    try:
        stl = STL(monthly, period=12).fit()
        stl_data = {
            'observed': stl.observed.tolist(),
            'trend': stl.trend.tolist(),
            'seasonal': stl.seasonal.tolist(),
            'remainder': stl.resid.tolist(),
            'dates': monthly.index.strftime('%Y-%m-%d').tolist()
        }
    except Exception as e:
        print(f"OPTIMA: [{item_name}] STL failed: {e}")
        stl_data = {}

    # 4. Prophet Fit (The Macro Phase)
    prophet_df = monthly.reset_index()
    prophet_df.columns = ['ds', 'y']
    
    # Remove timezone if any
    prophet_df['ds'] = prophet_df['ds'].dt.tz_localize(None)
    
    # 4a. Configure Prophet based on availability strategy
    prophet_config = {
        'yearly_seasonality': True,
        'weekly_seasonality': False,
        'daily_seasonality': False,
        'interval_width': 0.95
    }
    
    if availability_type == 'seasonal':
        # Seasonal items: amplify seasonality detection
        prophet_config['seasonality_prior_scale'] = 20  # Default is 10
        prophet_config['seasonality_mode'] = 'multiplicative'  # Capture % swings
        print(f"OPTIMA: [{item_name}] Applied SEASONAL tuning (seasonality_prior_scale=20, multiplicative mode)")
    
    elif availability_type == 'high_velocity':
        # High velocity items: respond faster to trend shifts
        prophet_config['changepoint_prior_scale'] = 0.10  # Default is 0.05
        prophet_config['seasonality_prior_scale'] = 5  # Reduce seasonality to emphasize trend
        print(f"OPTIMA: [{item_name}] Applied HIGH VELOCITY tuning (changepoint_prior_scale=0.10)")
    
    m = Prophet(**prophet_config)
    m.fit(prophet_df)
    
    # 5. Residual Extraction
    forecast_prophet = m.predict(prophet_df)
    residuals = prophet_df['y'] - forecast_prophet['yhat']
    
    # 6. SARIMA Fit (The Micro Phase - Residual Correction)
    try:
        # Use residuals as input for SARIMA
        try:
            # For seasonal items, force seasonal differencing (D=1)
            if availability_type == 'seasonal':
                resid_model = auto_arima(
                    residuals, 
                    seasonal=True, 
                    m=12,
                    D=1,  # Force seasonal differencing for seasonal items
                    error_action='ignore', 
                    suppress_warnings=True,
                    stepwise=True
                )
                print(f"OPTIMA: [{item_name}] Applied SEASONAL ARIMA with D=1")
            else:
                # Tier 1: Full Seasonal SARIMA (Requires 24+ months for stability)
                resid_model = auto_arima(
                    residuals, 
                    seasonal=True, 
                    m=12, 
                    error_action='ignore', 
                    suppress_warnings=True,
                    stepwise=True
                )
        except Exception as e:
            print(f"OPTIMA: [{item_name}] Full SARIMA failed: {e}. Attempting SARIMA without seasonal differencing (D=0).")
            try:
                # Tier 2: SARIMA without seasonal differencing (Compatible with 12+ months)
                # This still uses SARIMA architecture but avoids the 'insufficient samples' issue
                resid_model = auto_arima(
                    residuals, 
                    seasonal=True, 
                    m=12, 
                    D=0, 
                    error_action='ignore', 
                    suppress_warnings=True,
                    stepwise=True
                )
            except:
                print(f"OPTIMA: [{item_name}] SARIMA architecture totally incompatible. Using Prophet baseline.")
                resid_model = None
        
        # 7. Generate Future Prediction
        # Calculate months to forecast
        last_date = monthly.index.max()
        target_date = pd.to_datetime(forecast_end)
        horizon = (target_date.year - last_date.year) * 12 + (target_date.month - last_date.month)
        if horizon < 1: horizon = 1
        if horizon > 24: horizon = 24 # Cap at 2 years
        
        future_prophet = m.make_future_dataframe(periods=horizon, freq='MS')
        forecast_prophet_future = m.predict(future_prophet)
        
        # SARIMA Correction for future
        if resid_model:
            resid_forecast = resid_model.predict(n_periods=horizon)
        else:
            resid_forecast = np.zeros(horizon)
        
        # Combined Results
        # Join historical and future
        final_forecast = forecast_prophet_future[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()
        
        # Apply SARIMA correction to the future rows (where ds > last_date)
        future_mask = final_forecast['ds'] > last_date
        # Ensure lengths match
        correction = np.array(resid_forecast)
        final_forecast.loc[future_mask, 'yhat'] += correction
        # Also adjust intervals slightly for the added uncertainty of the residual model
        final_forecast.loc[future_mask, 'yhat_lower'] += (correction - np.abs(correction)*0.1)
        final_forecast.loc[future_mask, 'yhat_upper'] += (correction + np.abs(correction)*0.1)

        # Cleanup columns for UI
        final_forecast.rename(columns={'ds': 'forecast_date', 'yhat': 'predicted_quantity'}, inplace=True)
        
        # Add historical actuals for the chart
        actuals_map = monthly.to_dict()
        final_forecast['actual_quantity'] = final_forecast['forecast_date'].map(actuals_map)
        final_forecast['type'] = final_forecast['actual_quantity'].apply(lambda x: 'historical' if pd.notnull(x) else 'future')
        final_forecast['forecast_date'] = final_forecast['forecast_date'].dt.strftime('%Y-%m-%d')
        
        # Attach STL and Metrics as attributes
        final_forecast.attrs['stl'] = stl_data
        final_forecast.attrs['metrics'] = {
            **calculate_metrics(prophet_df['y'], forecast_prophet['yhat']),
            'status': 'optimal'
        }
        
        return final_forecast
        
    except Exception as e:
        print(f"OPTIMA: [{item_name}] Hybrid Fit failed: {e}")
        return pd.DataFrame()

def generate_dummy_forecast(monthly, forecast_end, item_name, status):
    """Fallback for zombies or items that fail fitting."""
    last_date = monthly.index.max()
    target_date = pd.to_datetime(forecast_end)
    horizon = (target_date.year - last_date.year) * 12 + (target_date.month - last_date.month)
    if horizon < 1: horizon = 1
    
    future_dates = pd.date_range(start=last_date + pd.offsets.MonthBegin(1), periods=horizon, freq='MS')
    all_dates = monthly.index.append(future_dates)
    
    df = pd.DataFrame({'forecast_date': all_dates})
    df['actual_quantity'] = df['forecast_date'].map(monthly.to_dict())
    df['predicted_quantity'] = 0.0
    df['type'] = df['actual_quantity'].apply(lambda x: 'historical' if pd.notnull(x) else 'future')
    df['forecast_date'] = df['forecast_date'].dt.strftime('%Y-%m-%d')
    df.attrs['metrics'] = {'status': status, 'mape_pct': 'N/A', 'mae': 'N/A', 'rmse': 'N/A'}
    return df

def calculate_metrics(actual, predicted):
    actual, predicted = np.array(actual), np.array(predicted)
    mae = np.mean(np.abs(actual - predicted))
    rmse = np.sqrt(np.mean((actual - predicted)**2))
    
    mask = actual != 0
    mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100 if np.any(mask) else 0
    
    return {
        'mape_pct': mape,
        'mae': float(mae),
        'rmse': float(rmse)
    }