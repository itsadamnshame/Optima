import pandas as pd

def generate_recommendations(forecast_df, rules_df):
    """
    Translates Quantitative forecasts and Qualitative rules into 
    Leader-Follower tactical plays.
    """
    if forecast_df.empty or rules_df.empty:
        return []

    # 1. Identify the "Leaders" (Items the user just forecasted)
    forecasted_items = forecast_df['item_description'].unique()
    
    # 2. Filter rules where the Antecedent (Leader) is in our forecast list
    # We look for rules where the 'antecedents' contain our forecasted items
    tactical_rules = rules_df[rules_df['antecedents'].apply(
        lambda x: any(item in x for item in forecasted_items)
    )].copy()

    # 3. Calculate "Strategic Lift"
    # We want to prioritize rules with Lift > 1 and high Confidence
    tactical_rules = tactical_rules.sort_values(by=['lift', 'confidence'], ascending=False)

    recommendations = []

    for _, rule in tactical_rules.iterrows():
        leader = list(rule['antecedents'])[0]
        follower = list(rule['consequents'])[0]
        
        # Find the specific forecast for this leader to provide context
        leader_forecast = forecast_df[forecast_df['item_description'] == leader]
        avg_predicted = leader_forecast['predicted_quantity'].mean() if not leader_forecast.empty else 0

        # Create the "Play"
        play = {
            "strategy_name": f"The {leader.split()[-1]} Velocity Multiplier",
            "leader": leader,
            "follower": follower,
            "logic": f"When {leader} sells, there is a {round(rule['confidence']*100, 1)}% chance the customer wants {follower}.",
            "lift_score": round(rule['lift'], 2),
            "support": round(rule['support'], 4),
            "predicted_leader_volume": round(avg_predicted, 0),
            "action_plan": f"Bundle {follower} as a 'Suggested Add-on' for {leader} during peak forecast windows."
        }
        recommendations.append(play)

    return recommendations[:15] # Return top 15 tactical plays