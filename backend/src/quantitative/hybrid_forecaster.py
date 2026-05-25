import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.seasonal import STL
from pmdarima import auto_arima
import datetime
import warnings

warnings.filterwarnings('ignore')

def aggregate_monthly(df, history_end=None):
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
    
    # 4. Fill gaps (ensure no months are missing between start and end/history_end)
    if not monthly.empty:
        end_date = monthly.index.max()
        if history_end is not None:
            history_end = pd.to_datetime(history_end)
            if history_end > end_date:
                end_date = history_end
        full_range = pd.date_range(start=monthly.index.min(), end=end_date, freq='MS')
        monthly = monthly.reindex(full_range, fill_value=0)
    
    return monthly

def detect_zombies(monthly_series):
    """
    Uses STL Trend and consecutive zero checks to identify 'Zombie' products (dead or dying).
    Returns True if the product has no recent sales or if the trend is effectively zero.
    """
    if monthly_series.empty:
        return True

    # 1. Direct check: If the last 6 months have 0 sales, it is a zombie (exceeds typical seasonal off-season)
    if len(monthly_series) >= 6 and (monthly_series.iloc[-6:] == 0).all():
        return True

    # 2. Check for short series: if less than 12 months, and the last 3 months have 0 sales
    if len(monthly_series) < 12:
        if len(monthly_series) >= 3 and (monthly_series.iloc[-3:] == 0).all():
            return True
        return False
        
    try:
        res = STL(monthly_series, period=12).fit()
        # For Volume (units), 0.5 is half a unit.
        threshold = 0.5
        
        last_trend = res.trend.iloc[-3:].mean()
        if last_trend < threshold:
            return True
    except:
        pass
    return False

def generate_insight_story(df, is_zombie, item_name):
    is_global = (item_name == "GLOBAL_STORE_TOTAL")
    
    if is_zombie:
        if is_global:
            return "The store-wide volume exhibits stagnant or near-zero historical sales. The model has flagged the macro trend as 'zombie' or inactive. Recommendation: Initiate a comprehensive operational review and verify data integrity."
        else:
            return f"The item '{item_name}' exhibits stagnant or near-zero historical sales. The model has flagged this as a 'zombie' product. Recommendation: Initiate lifecycle review, consider liquidation or strategic unbundling if bundled."
            
    # Calculate historical vs forecast
    historical = df[df['type'] == 'historical']['actual_value']
    future = df[df['type'] == 'future']['predicted_value']
    
    hist_avg = historical.mean() if not historical.empty else 0
    fut_avg = future.mean() if not future.empty else 0
    
    if hist_avg > 0:
        growth = ((fut_avg - hist_avg) / hist_avg) * 100
    else:
        growth = 0
        
    if growth > 5:
        if is_global:
            return f"The macro forecast projects a {growth:.1f}% increase in average store-wide volume. The decomposition signals a robust growth trend. Recommendation: Prepare supply chain capacity and macro inventory to capture expanding overall demand."
        else:
            return f"The forecast for '{item_name}' projects a {growth:.1f}% increase in average volume. The decomposition signals a robust growth trend. Recommendation: Increase inventory depth to capture expanding demand and avoid stockouts."
    elif growth < -5:
        if is_global:
            return f"The macro forecast indicates a {abs(growth):.1f}% decline in expected average store-wide volume. Recommendation: Audit global inventory levels and deploy macro-level promotional strategies to stimulate store-wide demand."
        else:
            return f"The forecast for '{item_name}' indicates a {abs(growth):.1f}% decline in expected average volume. Recommendation: Optimize inventory levels to prevent overstocking, and consider promotional strategies to stimulate demand."
    else:
        if is_global:
            return f"The macro forecast indicates stable overall demand with a {growth:.1f}% variance from historical averages. Recommendation: Maintain current global replenishment cycles as the underlying store trend is steady."
        else:
            return f"The forecast for '{item_name}' indicates stable demand with a {growth:.1f}% variance from historical averages. Recommendation: Maintain current replenishment cycles as the underlying trend is steady."


def preprocess_and_forecast_item(item_df, forecast_end, item_name="unknown", history_end=None):
    """
    Main entry point for the Hybrid Forecaster (Phase 2).
    
    Args:
        item_df: Transaction data for the item
        forecast_end: End date for forecast
        item_name: Item description/name
        history_end: Global end date of dataset history
    """
    print(f"OPTIMA: Analyzing {item_name}...")
    
    # 1. Aggregate
    monthly = aggregate_monthly(item_df, history_end=history_end)
    
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
    
    # 4a. Configure Prophet with automated defaults
    cp_prior = 0.05
    
    prophet_config = {
        'yearly_seasonality': True,
        'weekly_seasonality': False,
        'daily_seasonality': False,
        'interval_width': 0.95,
        'seasonality_prior_scale': 10,
        'changepoint_prior_scale': cp_prior
    }
    
    m = Prophet(**prophet_config)
    m.fit(prophet_df)
    
    # 5. Residual Extraction
    forecast_prophet = m.predict(prophet_df)
    residuals = prophet_df['y'] - forecast_prophet['yhat']
    
    # 6. SARIMA Fit (The Micro Phase - Residual Correction)
    try:
        try:
            # Tier 1: Full Seasonal SARIMA (auto_arima selects optimal D)
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
                # Tier 2: SARIMA without seasonal differencing
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
        last_date = monthly.index.max()
        target_date = pd.to_datetime(forecast_end)
        horizon = (target_date.year - last_date.year) * 12 + (target_date.month - last_date.month)
        if horizon < 1: horizon = 1
        if horizon > 24: horizon = 24  # Cap at 2 years

        future_prophet = m.make_future_dataframe(periods=horizon, freq='MS')
        forecast_prophet_future = m.predict(future_prophet)

        # SARIMA Correction for future
        if resid_model:
            resid_forecast = resid_model.predict(n_periods=horizon)
            historical_resid = resid_model.predict_in_sample()
        else:
            resid_forecast = np.zeros(horizon)
            historical_resid = np.zeros(len(residuals))

        # Combined Results
        final_forecast = forecast_prophet_future[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()

        # Apply SARIMA correction to the future rows (where ds > last_date)
        future_mask = final_forecast['ds'] > last_date
        
        correction = np.array(resid_forecast)
        
        final_forecast.loc[future_mask, 'yhat'] += correction
        final_forecast.loc[future_mask, 'yhat_lower'] += (correction - np.abs(correction) * 0.1)
        final_forecast.loc[future_mask, 'yhat_upper'] += (correction + np.abs(correction) * 0.1)

        # Zero floor: prevent impossible negative predictions
        for col in ['yhat', 'yhat_lower', 'yhat_upper']:
            final_forecast[col] = final_forecast[col].clip(lower=0)

        # Cleanup columns for UI
        final_forecast.rename(columns={'ds': 'forecast_date', 'yhat': 'predicted_value'}, inplace=True)

        # Add historical actuals for the chart
        actuals_map = monthly.to_dict()
        final_forecast['actual_value'] = final_forecast['forecast_date'].map(actuals_map)
        final_forecast['type'] = final_forecast['actual_value'].apply(lambda x: 'historical' if pd.notnull(x) else 'future')
        final_forecast['forecast_date'] = final_forecast['forecast_date'].dt.strftime('%Y-%m-%d')

        # Metric calculation: use final hybrid predictions in original space
        historical_pred = (forecast_prophet['yhat'].values + historical_resid).clip(0)

        # Attach STL and Metrics as attributes
        final_forecast.attrs['stl'] = stl_data
        
        metrics = {
            **calculate_metrics(prophet_df['y'].values, historical_pred),
            'status': 'optimal',
            'is_zombie': False
        }
        metrics['story'] = generate_insight_story(final_forecast, False, item_name)
        final_forecast.attrs['metrics'] = metrics

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
    df['actual_value'] = df['forecast_date'].map(monthly.to_dict())
    df['predicted_value'] = 0.0
    df['type'] = df['actual_value'].apply(lambda x: 'historical' if pd.notnull(x) else 'future')
    df['forecast_date'] = df['forecast_date'].dt.strftime('%Y-%m-%d')
    story = generate_insight_story(df, status == 'zombie', item_name)
    df.attrs['metrics'] = {'status': status, 'mape_pct': 'N/A', 'mae': 'N/A', 'rmse': 'N/A', 'is_zombie': status == 'zombie', 'story': story}
    return df

def calculate_metrics(actual, predicted):
    """
    Computes standard error metrics.
    Returns mape_pct as a direct error percentage (e.g. 5.0 for 5% error).
    """
    actual, predicted = np.array(actual), np.array(predicted)
    mae = np.mean(np.abs(actual - predicted))
    rmse = np.sqrt(np.mean((actual - predicted)**2))
    
    mask = actual != 0
    # Standard MAPE formula: Mean(|Actual - Predicted| / Actual) * 100
    mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100 if np.any(mask) else 0
    
    return {
        'mape_pct': mape,
        'mae': float(mae),
        'rmse': float(rmse)
    }