import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from sklearn.ensemble import RandomForestClassifier
from pathlib import Path
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

def create_cart_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Strips away dates/prices and turns the data into a binary shopping cart matrix.
    Rows = Order IDs, Columns = Items, Values = 1 (Bought) or 0 (Not Bought).
    """
    print("Pivoting transaction logs into shopping carts...")
    
    # 1. Group by Order ID and Item, then pivot items to columns
    basket = (df.groupby(['order_id', 'item_description'])['quantity']
              .sum().unstack().reset_index().fillna(0)
              .set_index('order_id'))
    
    # 2. Convert quantities to simple binary 1s and 0s
    basket = basket.map(lambda x: 1 if x > 0 else 0)
    
    return basket

def apply_random_forest_ranking(rules_df: pd.DataFrame) -> pd.DataFrame:
    """
    The Decision Layer: Uses a Random Forest Classifier to rank bundles 
    based on the interaction of support, confidence, and lift.
    """
    # Ensure we have enough data to train a meaningful model
    if rules_df.empty or len(rules_df) < 5:
        return rules_df

    print("Training Random Forest to rank bundle quality...")

    # 1. Feature Selection
    X = rules_df[['support', 'confidence', 'lift']]

    # 2. Synthetic Labeling (Target Y)
    # We define 'Success' as the top 30% of rules based on the lift-confidence product
    rules_df['momentum_score'] = rules_df['lift'] * rules_df['confidence']
    threshold = rules_df['momentum_score'].quantile(0.7)
    y = (rules_df['momentum_score'] >= threshold).astype(int)

    # 3. Model Training
    rf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    rf.fit(X, y)

    # 4. Success Probability Prediction
    probabilities = rf.predict_proba(X)[:, 1]
    rules_df['success_probability'] = (probabilities * 100).round(2)

    # Clean up and sort by probability
    final_df = rules_df.drop(columns=['momentum_score']).sort_values('success_probability', ascending=False)
    
    return final_df

def generate_bundle_rules(basket: pd.DataFrame, min_support: float = 0.001) -> pd.DataFrame:
    """
    Runs Apriori and calculates bundle sizes (2, 3, 4+) before 
    ranking with Random Forest.
    """
    print(f"Running Apriori algorithm (min_support={min_support})...")
    
    # 1. Find frequent itemsets
    # Increased max_len to 4 to allow for larger bundles
    frequent_itemsets = apriori(basket, min_support=min_support, use_colnames=True, low_memory=True, max_len=4)
    
    if frequent_itemsets.empty:
        print("Warning: No items met the support threshold.")
        return pd.DataFrame()

    # 2. Generate Association Rules
    rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.0)
    
    if rules.empty:
        return pd.DataFrame()

    # 3. CALCULATE BUNDLE SIZE (The "Logic" for your new feature)
    # Bundle Size = Number of items in Antecedents + Number of items in Consequents
    rules['bundle_size'] = rules['antecedents'].apply(lambda x: len(x)) + \
                           rules['consequents'].apply(lambda x: len(x))

    # 4. Convert frozensets to readable strings for the UI
    rules['antecedents_list'] = rules['antecedents'].apply(lambda x: ", ".join(list(x)))
    rules['consequents_list'] = rules['consequents'].apply(lambda x: ", ".join(list(x)))
    
    # Select clean columns for the Ranker
    clean_rules = rules[['antecedents_list', 'consequents_list', 'support', 'confidence', 'lift', 'bundle_size']].copy()
    
    # Rename for compatibility with the existing ranker
    clean_rules = clean_rules.rename(columns={
        'antecedents_list': 'antecedents',
        'consequents_list': 'consequents'
    })

    # 5. Apply the Random Forest Ranking
    ranked_rules = apply_random_forest_ranking(clean_rules)
    
    return ranked_rules

# ==========================================
# LOCAL TESTING BLOCK
# ==========================================
if __name__ == "__main__":
    file_path = Path("../../backend_storage/base_cleaned_sales.csv")
    
    if file_path.exists():
        raw_df = pd.read_csv(file_path)
        cart_matrix = create_cart_matrix(raw_df)
        
        bundle_rules = generate_bundle_rules(cart_matrix, min_support=0.01)
        
        if not bundle_rules.empty:
            print("\nTOP 5 STRATEGIC BUNDLE RECOMMENDATIONS:")
            print(bundle_rules.head(5))
        else:
            print("No strong rules found.")
    else:
        print("Data not found.")