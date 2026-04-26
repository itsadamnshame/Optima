import pandas as pd

def generate_categorized_recommendations(forecast_df, rules_df):
    """
    STRICT DATA ONLY: Categorizes real Apriori rules.
    If no rules match the forecast, it returns EMPTY, not placeholders.
    """
    
    # 1. Validation
    if forecast_df is None or rules_df is None or forecast_df.empty or rules_df.empty:
        return {"velocity": [], "affinity": [], "clearout": []}

    # 2. Get the items from your real forecast (The Leaders)
    forecasted_leaders = forecast_df['item_description'].unique()
    
    # 3. Match rules to your forecast
    # We use .astype(str) to ensure comparison works regardless of data types
    active_rules = rules_df[rules_df['antecedents'].astype(str).apply(
        lambda x: any(item in x for item in forecasted_leaders)
    )].copy()

    # CRITICAL: If no bundles exist for these items, we return empty.
    # If you see 'No Active Plays' in the UI after this, it means 
    # you need to lower your 'min_support' in main.py.
    if active_rules.empty:
        return {"velocity": [], "affinity": [], "clearout": []}

    def format_play(rule, strategy_label):
        # Directly extract from the dataframe columns created in apriori_model.py
        leader = str(rule['antecedents'])
        follower = str(rule['consequents'])
        
        conf_val = round(float(rule['confidence']) * 100, 1)
        
        return {
            "strategy_name": strategy_label,
            "leader": leader,
            "follower": follower,
            "lift": round(float(rule['lift']), 2),
            "confidence": conf_val,
            "support": round(float(rule['support']), 4),
            "logic": f"Statistically, {leader} drives a {conf_val}% interest in {follower}."
        }

    # CATEGORIZATION
    velocity_plays = [format_play(r, "Velocity Multiplier") for _, r in active_rules.sort_values(by='confidence', ascending=False).head(3).iterrows()]
    affinity_plays = [format_play(r, "High-Affinity Pair") for _, r in active_rules.sort_values(by='lift', ascending=False).head(3).iterrows()]
    clearout_plays = [format_play(r, "Stock Clearout Play") for _, r in active_rules.sort_values(by=['support', 'lift'], ascending=[True, False]).head(3).iterrows()]

    return {
        "velocity": velocity_plays,
        "affinity": affinity_plays,
        "clearout": clearout_plays
    }