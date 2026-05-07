import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from pathlib import Path
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

def create_cart_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Strips away dates/prices and turns the data into a binary shopping cart matrix.
    Rows = Order IDs, Columns = Items, Values = 1 (Bought) or 0 (Not Bought).
    """
    # Removed naked print for cleaner logs
    
    # 1. Group by Order ID and Item, then pivot items to columns
    basket = (df.groupby(['order_id', 'item_description'])['quantity']
              .sum().unstack().reset_index().fillna(0)
              .set_index('order_id'))
    
    # 2. Convert quantities to simple binary 1s and 0s
    basket = basket.map(lambda x: 1 if x > 0 else 0)
    
    return basket

def apply_random_forest_ranking(rules_df: pd.DataFrame) -> pd.DataFrame:
    """
    Fast scoring fallback for bundle ranking: deterministic scoring avoids expensive RF training.
    """
    if rules_df.empty or len(rules_df) < 5:
        return rules_df

    print("OPTIMA: Scoring bundle quality without heavy model training...")

    rules_df = rules_df.copy()
    rules_df['momentum_score'] = rules_df['lift'] * rules_df['confidence']
    min_score = rules_df['momentum_score'].min()
    max_score = rules_df['momentum_score'].max()

    if max_score <= min_score:
        rules_df['success_probability'] = 50.0
    else:
        rules_df['success_probability'] = (
            50 + 50 * (rules_df['momentum_score'] - min_score) / (max_score - min_score)
        ).round(2)

    final_df = rules_df.drop(columns=['momentum_score']).sort_values('success_probability', ascending=False)
    return final_df

def generate_bundle_rules(basket: pd.DataFrame, raw_df: pd.DataFrame, min_support: float = 0.001) -> pd.DataFrame:
    """
    Runs Apriori with a dynamic grid search for the optimal support threshold,
    then ranks results with a fast deterministic score.
    """
    print("OPTIMA: Searching for optimal support threshold...")
    
    # Grid search for min_support
    # We want a threshold that yields enough rules without exploding runtime.
    possible_supports = [0.02, 0.005, 0.002, 0.001, 0.0005]
    best_support = min_support
    frequent_itemsets = pd.DataFrame()
    rules = pd.DataFrame()

    for s in possible_supports:
        try:
            frequent_itemsets = apriori(basket, min_support=s, use_colnames=True, low_memory=True, max_len=4)
            if frequent_itemsets.empty: continue
            
            rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.1)
            if 30 <= len(rules) <= 300:
                best_support = s
                print(f"OPTIMA: Found optimal support threshold: {best_support} ({len(rules)} rules)")
                break
            elif len(rules) > 300:
                # If we have too many rules, the current support is the best we can do before it gets too sparse
                best_support = s
                rules = rules.sort_values('lift', ascending=False).head(300)
                print(f"OPTIMA: Support {s} too broad ({len(rules)} rules), capping at 300.")
                break
        except Exception as e:
            print(f"Support search error at {s}: {e}")
            continue

    if rules.empty:
        print("Warning: No items met the dynamic support threshold. Falling back to default.")
        # Final fallback attempt
        frequent_itemsets = apriori(basket, min_support=0.001, use_colnames=True, low_memory=True, max_len=4)
        if frequent_itemsets.empty: return pd.DataFrame()
        rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.0)
    
    if rules.empty: return pd.DataFrame()

    # 3. CALCULATE BUNDLE SIZE
    rules['bundle_size'] = rules['antecedents'].apply(lambda x: len(x)) + \
                           rules['consequents'].apply(lambda x: len(x))

    # 4. CALCULATE FINANCIAL COST
    item_price_map = raw_df.groupby('item_description')['unit_cost'].mean().to_dict()
    
    def get_bundle_cost(item_set):
        return sum([item_price_map.get(item, 0.0) for item in item_set])
        
    rules['bundle_total_cost'] = rules['antecedents'].apply(get_bundle_cost) + \
                                 rules['consequents'].apply(get_bundle_cost)

    # 5. Convert frozensets to readable strings for the UI
    rules['antecedents_list'] = rules['antecedents'].apply(lambda x: ", ".join(list(x)))
    rules['consequents_list'] = rules['consequents'].apply(lambda x: ", ".join(list(x)))
    
    # Select clean columns for the Ranker
    clean_rules = rules[['antecedents_list', 'consequents_list', 'support', 'confidence', 'lift', 'bundle_size', 'bundle_total_cost']].copy()
    
    # Rename for compatibility with the existing ranker
    clean_rules = clean_rules.rename(columns={
        'antecedents_list': 'antecedents',
        'consequents_list': 'consequents'
    })

    # 5. Apply the Random Forest Ranking
    ranked_rules = apply_random_forest_ranking(clean_rules)
    
    return ranked_rules

def analyze_custom_bundle(basket: pd.DataFrame, items: list, raw_df: pd.DataFrame) -> dict:
    """
    Calculates specific association metrics for a user-provided bundle of 2-4 items.
    """
    if not items or len(items) < 2:
        return {"error": "Select at least 2 items."}

    # 1. Calculate Support for the bundle (intersection of all items)
    # Filter columns to only those that exist in the basket
    valid_items = [i for i in items if i in basket.columns]
    if len(valid_items) < len(items):
        return {"error": "One or more items not found in current dataset."}

    # Support(Bundle) = Number of transactions containing ALL items / Total Transactions
    mask = basket[valid_items].all(axis=1)
    support_bundle = mask.mean()

    # 2. To calculate Confidence and Lift, we need to split the bundle into Antecedent and Consequent.
    # For a custom bundle, we'll treat the FIRST item as Antecedent and OTHERS as Consequent for basic metrics.
    # However, a more robust "Bundle Strength" is simply the Support and how it compares to individual supports.
    
    # Let's calculate Lift: Support(A&B) / (Support(A) * Support(B))
    # For N items, it's Support(All) / Product of Individual Supports
    indiv_supports = [basket[i].mean() for i in valid_items]
    product_supports = 1.0
    for s in indiv_supports: product_supports *= s
    
    lift = support_bundle / product_supports if product_supports > 0 else 0

    # Calculate individual metrics
    metrics = {
        "support": round(float(support_bundle), 6),
        "lift": round(float(lift), 4),
        "bundle_size": len(valid_items)
    }

    # 3. Calculate Financial Cost
    item_price_map = raw_df.groupby('item_description')['unit_cost'].mean().to_dict()
    total_cost = sum([item_price_map.get(i, 0.0) for i in valid_items])
    metrics["bundle_total_cost"] = round(float(total_cost), 2)

    # 4. Use Random Forest to predict "Success Probability" 
    # (We need to mock a confidence value for the RF model, let's use 0.5 as neutral)
    X = pd.DataFrame([{
        'support': metrics['support'],
        'confidence': 0.5, 
        'lift': metrics['lift'],
        'bundle_size': metrics['bundle_size'],
        'bundle_total_cost': metrics['bundle_total_cost']
    }])
    
    # We'll re-run the rule generation to get a trained RF model instance 
    # Or better: generate rules first to train the model, then predict for custom.
    # For now, let's just return the raw metrics.
    
    return metrics

# ==========================================
# LOCAL TESTING BLOCK
# ==========================================
if __name__ == "__main__":
    file_path = Path("../../backend_storage/base_cleaned_sales.csv")
    
    if file_path.exists():
        raw_df = pd.read_csv(file_path)
        cart_matrix = create_cart_matrix(raw_df)
        
        bundle_rules = generate_bundle_rules(cart_matrix, raw_df, min_support=0.01)
        
        if not bundle_rules.empty:
            print("\nTOP 5 STRATEGIC BUNDLE RECOMMENDATIONS:")
            print(bundle_rules.head(5))
        else:
            print("No strong rules found.")
    else:
        print("Data not found.")