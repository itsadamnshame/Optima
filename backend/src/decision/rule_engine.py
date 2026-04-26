import pandas as pd
from pathlib import Path
import json

def generate_recommendations(forecast_df: pd.DataFrame, rules_df: pd.DataFrame) -> list:
    """
    The Brain of OPTIMA. Merges forecasts with association rules to generate plain-English advice.
    """
    print("Initializing Decision Engine...")
    recommendations = []

    # ---------------------------------------------------------
    # STRATEGY 1: The "Hero & Sidekick" Bundle (Apriori + Prophet)
    # ---------------------------------------------------------
    if not rules_df.empty:
        # Filter for high-quality rules
        strong_rules = rules_df[(rules_df['confidence'] > 0.5) & (rules_df['lift'] > 1.0)]

        for index, rule in strong_rules.iterrows():
            # UPDATED: Using 'antecedents' and 'consequents' to stay synced with apriori_model.py
            hero_item = rule['antecedents']
            sidekick_item = rule['consequents']
            
            # Check if the hero item was forecasted in the quantitative branch
            hero_forecasts = forecast_df[forecast_df['item_description'] == hero_item]
            
            if not hero_forecasts.empty:
                total_projected = int(hero_forecasts['predicted_quantity'].sum())
                if total_projected > 0:
                    recommendations.append({
                        "type": "Bundle Strategy",
                        "target_item": hero_item,
                        "action": f"Bundle with '{sidekick_item}'",
                        "justification": f"'{hero_item}' is projected to sell {total_projected} units soon. Apriori math shows bundling it with '{sidekick_item}' increases conversion by {round(rule['lift'], 2)}x."
                    })

    # ---------------------------------------------------------
    # STRATEGY 2: High Volume Alerts (Prophet Only)
    # Provides the top forecasted items regardless of bundling.
    # ---------------------------------------------------------
    if not forecast_df.empty:
        # Group the forecasts by item to get total upcoming volume
        upcoming_totals = forecast_df.groupby('item_description')['predicted_quantity'].sum().sort_values(ascending=False)
        
        for item, volume in upcoming_totals.head(3).items(): # Grab the top 3
            if volume > 0:
                recommendations.append({
                    "type": "Stock & Promotion Alert",
                    "target_item": item,
                    "action": "Ensure high stock levels and run standard top-of-funnel ads.",
                    "justification": f"Time-series AI projects a high movement of {int(volume)} units over the next 4 weeks based on historical seasonality."
                })

    return recommendations

# ==========================================
# LOCAL TESTING BLOCK
# ==========================================
if __name__ == "__main__":
    import sys
    sys.path.append("../../") 
    
    try:
        from src.qualitative.apriori_model import create_cart_matrix, generate_bundle_rules
        
        file_path = Path("../../backend_storage/base_cleaned_sales.csv")
        
        if file_path.exists():
            print("Simulating full pipeline integration...")
            raw_df = pd.read_csv(file_path)
            
            # Get the rules (Now with Random Forest success_probability included)
            cart_matrix = create_cart_matrix(raw_df)
            bundle_rules = generate_bundle_rules(cart_matrix, min_support=0.01)
            
            # Mock forecast data
            mock_forecast = pd.DataFrame({
                'item_description': ['Level Promotion', 'Fast Track Promo'],
                'predicted_quantity': [500, 200] 
            })
            
            # Generate the final output
            final_advice = generate_recommendations(mock_forecast, bundle_rules)
            
            print("\n==============================================")
            print("🧠 OPTIMA DECISION ENGINE OUTPUT:")
            print("==============================================")
            print(json.dumps(final_advice, indent=4))
            
        else:
            print("Data not found.")
            
    except ImportError as e:
        print(f"Import error during local test: {e}")