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
    """
    Generates a rich, data-driven business narrative for the Sales Trend Summary card.
    Always returns a meaningful story — never 'unknown'.
    """
    # Calculate historical vs forecast volumes
    historical = df[df['type'] == 'historical']['actual_value'].dropna()
    future = df[df['type'] == 'future']['predicted_value'].dropna()

    hist_avg = float(historical.mean()) if not historical.empty else 0.0
    fut_avg  = float(future.mean())  if not future.empty  else 0.0
    hist_total = float(historical.sum()) if not historical.empty else 0.0
    fut_total  = float(future.sum())  if not future.empty  else 0.0

    if hist_avg > 0:
        growth = ((fut_avg - hist_avg) / hist_avg) * 100
    else:
        growth = 0.0

    # Month count for context
    hist_months = len(historical)
    fut_months  = len(future)

    # Display-friendly name
    display_name = "your store" if item_name == "GLOBAL_STORE_TOTAL" else f"'{item_name}'"
    is_global    = (item_name == "GLOBAL_STORE_TOTAL")

    if is_zombie:
        status = "STAGNANT"
        if hist_avg > 0:
            # Product had sales before but has stopped
            story = (
                f"{display_name.capitalize()} averaged {hist_avg:.0f} units/month historically, "
                f"but sales have come to a complete stop in recent months — a clear sign of "
                f"declining demand or stock issues. "
                f"The model has capped the forecast at zero because there is no meaningful upward "
                f"trend to project. "
                f"Action: Review whether this {'store' if is_global else 'product'} is still "
                f"actively stocked and promoted. Consider a clearance campaign or "
                f"investigate if a supply disruption is causing the drop."
            )
        else:
            # Never really had sales
            story = (
                f"{display_name.capitalize()} shows no recorded sales activity. "
                f"There is no historical demand signal for the model to learn from, "
                f"so the forecast is held at zero. "
                f"This typically happens when a product is newly listed, out of stock, "
                f"or has been discontinued. "
                f"Action: Verify the product data is correct and that it has been "
                f"actively available to customers for at least 3–6 months before re-running the forecast."
            )
    elif growth > 15:
        status = "GROWTH"
        story = (
            f"{display_name.capitalize()} is on a strong upward trajectory. "
            f"Over the last {hist_months} months, average monthly sales were {hist_avg:.0f} units. "
            f"The forecast projects this rising to {fut_avg:.0f} units/month — "
            f"a {growth:.1f}% increase over the next {fut_months} months "
            f"(total forecast: {fut_total:.0f} units). "
            f"This level of growth signals rising customer demand and warrants "
            f"proactive stock increases. "
            f"Action: Increase reorder quantities by at least {min(growth, 50):.0f}% and "
            f"negotiate with suppliers for priority fulfillment to avoid stockouts during "
            f"peak demand periods."
        )
    elif growth > 5:
        status = "GROWTH"
        story = (
            f"{display_name.capitalize()} is showing steady, healthy growth. "
            f"Historical average: {hist_avg:.0f} units/month. "
            f"The forecast predicts {fut_avg:.0f} units/month going forward — "
            f"a {growth:.1f}% improvement over the coming {fut_months} months "
            f"(projected total: {fut_total:.0f} units). "
            f"This consistent upward trend indicates reliable demand. "
            f"Action: Ensure stock levels are sufficient to cover the projected increase. "
            f"A modest {growth:.0f}% uplift in your reorder plan should be enough to "
            f"meet demand without over-ordering."
        )
    elif growth < -15:
        status = "DECLINE"
        story = (
            f"{display_name.capitalize()} is experiencing a significant drop in demand. "
            f"Monthly sales averaged {hist_avg:.0f} units historically, "
            f"but the forecast projects only {fut_avg:.0f} units/month — "
            f"a {abs(growth):.1f}% decline over the next {fut_months} months "
            f"(projected total: {fut_total:.0f} units). "
            f"This level of decline signals a shrinking customer base or a market shift. "
            f"Action: Run targeted promotions or bundle deals to stimulate demand. "
            f"Reduce incoming stock orders and consider liquidating excess inventory "
            f"to minimise holding costs."
        )
    elif growth < -5:
        status = "DECLINE"
        story = (
            f"{display_name.capitalize()} is trending slightly downward. "
            f"Historical average was {hist_avg:.0f} units/month, "
            f"while the forecast predicts {fut_avg:.0f} units/month — "
            f"a {abs(growth):.1f}% dip over the next {fut_months} months "
            f"(projected total: {fut_total:.0f} units). "
            f"This is an early warning sign worth monitoring. "
            f"Action: Launch a promotional push or bundle this item with faster-moving "
            f"products to arrest the slowdown before it becomes a sustained trend."
        )
    else:
        status = "STABLE"
        story = (
            f"{display_name.capitalize()} is holding steady. "
            f"Historical average was {hist_avg:.0f} units/month, "
            f"and the forecast projects {fut_avg:.0f} units/month — "
            f"only a {growth:+.1f}% change over {fut_months} months "
            f"(projected total: {fut_total:.0f} units). "
            f"This stability reflects predictable, recurring demand — ideal for "
            f"lean inventory management. "
            f"Action: Maintain current stock levels and reorder cadence. "
            f"Use this predictability to negotiate better supplier terms "
            f"by committing to consistent order volumes."
        )

    return status, story


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
        trend_status, story = generate_insight_story(final_forecast, False, item_name)
        metrics['trend_status'] = trend_status
        metrics['story'] = story
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
    trend_status, story = generate_insight_story(df, status == 'zombie', item_name)
    df.attrs['metrics'] = {'status': status, 'mape_pct': 'N/A', 'mae': 'N/A', 'rmse': 'N/A', 'is_zombie': status == 'zombie', 'trend_status': trend_status, 'story': story}
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