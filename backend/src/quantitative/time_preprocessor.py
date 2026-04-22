import pandas as pd
from pathlib import Path

def prepare_time_series(df: pd.DataFrame, freq: str = 'W') -> pd.DataFrame:
    """
    Transforms raw transaction data into a continuous time-series format.
    freq: 'W' for Weekly (Default for health/beauty), 'D' for Daily, 'M' for Monthly.
    """
    print(f"Aggregating time-series data at '{freq}' frequency...")
    
    # 1. Ensure the date column is a proper mathematical datetime object
    df['order_date'] = pd.to_datetime(df['order_date'])
    
    # We isolate the columns we actually care about forecasting (Volume)
    # You could also swap 'quantity' for 'total' if you want to forecast revenue instead of stock
    ts_df = df[['order_date', 'item_description', 'quantity']].copy()
    
    # 2. Group by the item and resample the timeline
    processed_frames = []
    items = ts_df['item_description'].unique()
    
    for item in items:
        # Isolate one product at a time
        item_data = ts_df[ts_df['item_description'] == item].copy()
        
        # Set the date as the index (Pandas requires this to stretch the timeline)
        item_data.set_index('order_date', inplace=True)
        
        # THE MAGIC STEP: 
        # .resample() groups the data into neat weekly buckets.
        # .sum() adds up all the quantities sold in that week.
        # .fillna(0) injects a 0 if the week had absolutely no sales.
        item_resampled = item_data[['quantity']].resample(freq).sum().fillna(0)
        
        # Put the item name back on the rows
        item_resampled['item_description'] = item
        processed_frames.append(item_resampled)
        
    # 3. Stitch all the continuous items back together
    final_ts_df = pd.concat(processed_frames)
    
    # Reset the index so 'order_date' becomes a normal column again (Prophet requires this)
    final_ts_df.reset_index(inplace=True)
    
    return final_ts_df

# ==========================================
# LOCAL TESTING BLOCK
# ==========================================
if __name__ == "__main__":
    # If you run this file directly, it will test itself using Module 1's output
    # Notice the path goes up two levels (../../) to find the backend_storage folder
    file_path = Path("../../backend_storage/base_cleaned_sales.csv")
    
    if file_path.exists():
        raw_df = pd.read_csv(file_path)
        weekly_data = prepare_time_series(raw_df, freq='W')
        
        print("\nSuccess! Here is a snapshot of the continuous timeline:")
        print(weekly_data.head(10))
        print(f"\nTotal historical data points formatted: {len(weekly_data)}")
    else:
        print("Error: Could not find base_cleaned_sales.csv. Make sure Module 1 ran successfully.")