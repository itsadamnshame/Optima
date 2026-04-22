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
    print("Pivoting transaction logs into shopping carts...")
    
    # 1. Group by Order ID and Item, then pivot items to columns
    basket = (df.groupby(['order_id', 'item_description'])['quantity']
              .sum().unstack().reset_index().fillna(0)
              .set_index('order_id'))
    
    # 2. Convert quantities to simple binary 1s and 0s
    # Apriori doesn't care if they bought 5 units of Vitamin C, only THAT they bought it.
    basket = basket.map(lambda x: 1 if x > 0 else 0)
    
    return basket

def generate_bundle_rules(basket: pd.DataFrame, min_support: float = 0.01) -> pd.DataFrame:
    """
    Runs the Apriori algorithm to find statistical product associations.
    min_support = 0.01 means the items must appear together in at least 1% of all transactions.
    """
    print(f"Running Apriori algorithm (min_support={min_support})...")
    
    # 1. Find frequent itemsets
    # low_memory=True prevents the server from crashing if the matrix is huge
    frequent_itemsets = apriori(basket, min_support=min_support, use_colnames=True, low_memory=True)
    
    if frequent_itemsets.empty:
        print("Warning: No items met the support threshold. Try lowering min_support.")
        return pd.DataFrame()

    # 2. Generate Association Rules (We want rules with a 'lift' greater than 1)
    # Lift > 1 means the items are bought together MORE often than random chance.
    rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.0)
    
    if rules.empty:
        return pd.DataFrame()

    # 3. Clean up the output for the Decision Engine
    # Convert 'frozensets' to clean strings
    rules['antecedents'] = rules['antecedents'].apply(lambda x: list(x)[0])
    rules['consequents'] = rules['consequents'].apply(lambda x: list(x)[0])
    
    # Sort by the strongest Lift score
    rules = rules.sort_values('lift', ascending=False)
    
    # Keep only the columns the Decision Engine actually needs
    clean_rules = rules[['antecedents', 'consequents', 'support', 'confidence', 'lift']].copy()
    
    clean_rules = clean_rules.rename(columns={
        'antecedents': 'item_a',
        'consequents': 'item_b'
    })
    
    return clean_rules

# ==========================================
# LOCAL TESTING BLOCK
# ==========================================
if __name__ == "__main__":
    file_path = Path("../../backend_storage/base_cleaned_sales.csv")
    
    if file_path.exists():
        raw_df = pd.read_csv(file_path)
        
        # Build the matrix
        cart_matrix = create_cart_matrix(raw_df)
        print(f"Matrix built! Analyzing {len(cart_matrix)} unique shopping carts...\n")
        
        # Run Apriori
        # Note: If it prints no rules, we will change 0.01 to 0.005 (0.5%)
        bundle_rules = generate_bundle_rules(cart_matrix, min_support=0.01)
        
        if not bundle_rules.empty:
            print("🛒 TOP 5 MOST POWERFUL BUNDLE COMBINATIONS:")
            print(bundle_rules.head(5))
        else:
            print("No strong rules found at 1% support.")
    else:
        print("Data not found. Run Module 1 first.")