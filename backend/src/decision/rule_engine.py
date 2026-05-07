import pandas as pd

def generate_categorized_recommendations(forecast_df, rules_df):
    """
    Categorizes rules into 3 missions while preserving bundle_size (2, 3, 4).
    Supports multi-item antecedents and removes directional duplicates.
    """
    
    if forecast_df is None or rules_df is None or forecast_df.empty or rules_df.empty:
        return {"velocity": [], "affinity": [], "clearout": []}

    forecasted_leaders = forecast_df['item_description'].unique()
    
    # 1. Filter: Match any part of the multi-item set to the forecast
    active_rules = rules_df[rules_df['antecedents'].astype(str).apply(
        lambda x: any(item.strip() in x for item in forecasted_leaders)
    )].copy()

    if active_rules.empty:
        return {"velocity": [], "affinity": [], "clearout": []}

    # 2. Advanced De-duplication
    def create_bundle_id(row):
        # Combines all items in the rule alphabetically to catch A+B->C vs C+A->B
        all_items = str(row['antecedents']).split(", ") + str(row['consequents']).split(", ")
        return "-".join(sorted(list(set(all_items))))

    active_rules['bundle_id'] = active_rules.apply(create_bundle_id, axis=1)
    unique_rules = active_rules.sort_values('confidence', ascending=False).drop_duplicates('bundle_id')

    def format_play(rule, strategy_label):
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
            "bundle_size": int(rule['bundle_size']), # PASSING THE SIZE TO UI
            "logic": f"Statistically, the combination of [{leader}] drives a {conf_val}% interest in [{follower}]."
        }

    # 3. Categorization (Global pool - UI will handle the specific 2/3/4 filter)
    # We take a larger head(15) here so the UI has enough 2s, 3s, and 4s to display
    velocity_plays = [format_play(r, "Velocity Multiplier") for _, r in unique_rules.sort_values(by='confidence', ascending=False).head(15).iterrows()]
    affinity_plays = [format_play(r, "High-Affinity Pair") for _, r in unique_rules.sort_values(by='lift', ascending=False).head(15).iterrows()]
    clearout_plays = [format_play(r, "Stock Clearout Play") for _, r in unique_rules.sort_values(by=['support', 'lift'], ascending=[True, False]).head(15).iterrows()]

    return {
        "velocity": velocity_plays,
        "affinity": affinity_plays,
        "clearout": clearout_plays
    }