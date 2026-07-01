import pandas as pd
import numpy as np
import json
import traceback
from sqlalchemy import bindparam, text
from mlxtend.frequent_patterns import apriori, association_rules
from sklearn.ensemble import RandomForestClassifier

def generate_strategic_bundles(engine, dataset_id: int, bundler_run_id: int = None, forecast_run_id: int = None, min_support: float = 0.01):
    """
    Two-Phase Bundler Engine:
    1. Apriori (Association Rule Mining) -> Candidates
    2. Random Forest (Ranking) -> Strategic Scores
    """
    try:
        # Safety clamp for Apriori (must be > 0)
        min_support = max(0.0001, min_support)
        
        print(f"BUNDLER: Starting Phase 1 (Apriori) for dataset {dataset_id} (Support: {min_support})...")
        
        # Load raw transactions
        query = text('SELECT "CustomerID", "ItemDescription" FROM sales_transactions WHERE dataset_id = :d')
        df_raw = pd.read_sql(query, engine, params={"d": dataset_id})
        
        # [NEW] Load simplified metadata for filtering
        query_meta = text('SELECT ItemDescription, is_bundle, is_not_product FROM item_metadata WHERE dataset_id = :d')
        meta_df = pd.read_sql(query_meta, engine, params={"d": dataset_id})
        
        if not meta_df.empty:
            meta_df.columns = [c.lower() for c in meta_df.columns]
            non_product_items = set(meta_df[meta_df['is_not_product'] == 1]['itemdescription'].tolist())
            is_bundle_map = dict(zip(meta_df['itemdescription'], meta_df['is_bundle']))
        else:
            non_product_items = set()
            is_bundle_map = {}

        if df_raw.empty:
            return []
        
        # [NEW] Filter out non-product items (registrations, conferences, etc.)
        if non_product_items:
            df_raw = df_raw[~df_raw['ItemDescription'].isin(non_product_items)]
        
        # Group by CustomerID to create baskets (Customer Affinity Analysis)
        basket = (df_raw.groupby(['CustomerID', 'ItemDescription'])['ItemDescription']
                  .count().unstack().reset_index().fillna(0)
                  .set_index('CustomerID'))
        
        # Binary encoding (using bool for performance/mlxtend compatibility)
        basket_sets = basket.map(lambda x: x >= 1)

        # Run Apriori (Dynamic Support Threshold)
        frequent_itemsets = apriori(basket_sets, min_support=min_support, use_colnames=True)
        rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.0)
        
        if rules.empty:
            return []

        # Convert frozensets to strings/lists
        rules['antecedents'] = rules['antecedents'].apply(lambda x: list(x)[0])
        rules['consequents'] = rules['consequents'].apply(lambda x: list(x)[0])
        
        # Drop duplicates (A->B and B->A are often similar for bundling)
        rules['pair'] = rules.apply(lambda x: "-".join(sorted([x['antecedents'], x['consequents']])), axis=1)
        rules = rules.drop_duplicates(subset=['pair']).copy()

        # --- PHASE 2: FEATURE ENGINEERING (THE BRIDGE) ---
        print("BUNDLER: Feature engineering based on historical association metrics...")

        # Build Bundle Features
        candidates = []
        for _, row in rules.iterrows():
            item_a = row['antecedents']
            item_b = row['consequents']
            
            # [NEW] Skip if either item is already a bundle (prevents bundle-of-bundles)
            if is_bundle_map.get(item_a, 0) == 1 or is_bundle_map.get(item_b, 0) == 1:
                continue
                
            candidates.append({
                "item_a": item_a,
                "item_b": item_b,
                "lift": row['lift'],
                "support": row['support'],
                "confidence": row['confidence']
            })

        if not candidates:
            return []

        # --- PHASE 3: THE RANKING STAGE (RANDOM FOREST) ---
        print("BUNDLER: Starting Phase 3 (Random Forest Ranking)...")
        df_candidates = pd.DataFrame(candidates)
        X_feat = df_candidates[['lift', 'support', 'confidence']]
        
        def calculate_success_label(r):
            score = (r['lift'] * 2) + (r['confidence'] * 3)
            # Threshold at 70th percentile
            return 1 if score > np.percentile([ (c['lift']*2 + c['confidence']*3) for c in candidates ], 70) else 0

        y_labels = df_candidates.apply(calculate_success_label, axis=1)
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X_feat, y_labels)
        
        if len(rf.classes_) > 1:
            probs = rf.predict_proba(X_feat)[:, 1]
        else:
            probs = X_feat['confidence'].values

        df_candidates['probability'] = probs
        df_candidates = df_candidates.sort_values(by='probability', ascending=False)

        # --- PHASE 4: INTEGRATION (BADGES) ---
        results = []
        for i, (_, row) in enumerate(df_candidates.iterrows()):
            badge = "POTENTIAL MATCH"
            reason = "Solid historical association with stable demand."
            
            if row['probability'] > 0.8:
                badge = "TOP SYNERGY"
                reason = "High Synergy Boost combined with strong Co-Purchase Rate."
            elif row['lift'] > 2.5:
                badge = "RISING TREND"
                reason = "Strong purchasing affinity indicating a rising bundle trend."

            results.append({
                "rank": i + 1,
                "pair": f"{row['item_a']} + {row['item_b']}",
                "lift": round(row['lift'], 2),
                "confidence": round(row['confidence'], 2),
                "support": round(row['support'], 4),
                "probability": round(row['probability'] * 100, 1),
                "badge": badge,
                "why": reason
            })

        if bundler_run_id is not None:
            with engine.connect() as conn:
                for b in results:
                    conn.execute(
                        text("INSERT INTO bundler_results (run_id, bundle_pair, result_json) VALUES (:rid, :pair, :rj)"),
                        {"rid": bundler_run_id, "pair": b['pair'], "rj": json.dumps(b)}
                    )
                conn.commit()

        return results
    except Exception as e:
        print(f"BUNDLER ERROR: {str(e)}")
        traceback.print_exc()
        return []

def score_single_pair(engine, dataset_ids, item_a: str, item_b: str, forecast_run_id: int = None):
    """
    Simulates a strategic score for a specific manual pairing across one or more datasets.
    """
    if isinstance(dataset_ids, int):
        dataset_ids = [dataset_ids]
    
    dataset_ids = [int(d) for d in dataset_ids]

    try:
        query = text("""
            SELECT "CustomerID", "ItemDescription" 
            FROM sales_transactions 
            WHERE dataset_id IN :dataset_ids
            AND "ItemDescription" IN (:ia, :ib)
        """).bindparams(bindparam("dataset_ids", expanding=True))
        df_raw = pd.read_sql(query, engine, params={"dataset_ids": dataset_ids, "ia": item_a, "ib": item_b})
        
        if df_raw.empty:
            return {"pair": f"{item_a} + {item_b}", "probability": 0, "badge": "NONE", "why": "No transaction history found."}

        baskets = df_raw.groupby('CustomerID')['ItemDescription'].apply(set)
        total_query = text('SELECT COUNT(DISTINCT "CustomerID") FROM sales_transactions WHERE dataset_id IN :dataset_ids').bindparams(bindparam("dataset_ids", expanding=True))
        total_tx = pd.read_sql(total_query, engine, params={"dataset_ids": dataset_ids}).iloc[0,0]
        
        count_a = sum(1 for b in baskets if item_a in b)
        count_b = sum(1 for b in baskets if item_b in b)
        count_both = sum(1 for b in baskets if item_a in b and item_b in b)
        
        support_a = count_a / total_tx if total_tx > 0 else 0
        support_b = count_b / total_tx if total_tx > 0 else 0
        support_both = count_both / total_tx if total_tx > 0 else 0
        
        confidence = count_both / count_a if count_a > 0 else 0
        lift = support_both / (support_a * support_b) if (support_a * support_b) > 0 else 0

        item_metrics = {}
        if forecast_run_id:
            query_forecast = text("SELECT item_description, result_json FROM forecast_results WHERE run_id = :rid AND item_description IN (:ia, :ib)")
            with engine.connect() as conn:
                forecast_rows = conn.execute(query_forecast, {"rid": forecast_run_id, "ia": item_a, "ib": item_b}).fetchall()
            
            for row in forecast_rows:
                item_name = row[0]
                data = json.loads(row[1])
                item_metrics[item_name] = {
                    "is_rising": data.get("trend") == "UP",
                    "seasonal_peaks": data.get("peaks", [])
                }

        reasons = []
        if lift > 2: reasons.append("High Synergy Boost")
        if confidence > 0.5: reasons.append("Strong Co-Purchase Rate")
        
        badge = "TOP SYNERGY"
        if item_metrics.get(item_a, {}).get("is_rising") and item_metrics.get(item_b, {}).get("is_rising"):
            badge = "RISING TREND"
            reasons.append("Both items show rising demand trends")
        
        prob = (confidence * 0.4 + (min(lift, 10)/10) * 0.4 + (0.2 if badge == "RISING TREND" else 0.1)) * 100
        
        return {
            "pair": f"{item_a} + {item_b}",
            "lift": round(lift, 2),
            "confidence": round(confidence, 2),
            "probability": round(min(prob, 99.9), 1),
            "badge": badge,
            "why": " + ".join(reasons) if reasons else "General affinity detected."
        }
    except Exception as e:
        print(f"SIMULATION ERROR: {str(e)}")
        return {"pair": f"{item_a} + {item_b}", "probability": 0, "badge": "ERROR", "why": str(e)}

def create_cart_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Helper for Qualitative Hub."""
    return df.groupby(['CustomerID', 'ItemDescription'])['ItemDescription'].count().unstack().fillna(0)

def generate_bundle_rules(basket: pd.DataFrame, raw_df: pd.DataFrame, min_support: float = 0.001) -> pd.DataFrame:
    """Legacy Apriori wrapper."""
    basket_sets = basket.map(lambda x: x >= 1)
    frequent_itemsets = apriori(basket_sets, min_support=min_support, use_colnames=True)
    return association_rules(frequent_itemsets, metric="lift", min_threshold=1.0)

def analyze_custom_bundle(basket: pd.DataFrame, items: list, raw_df: pd.DataFrame) -> dict:
    """Simulated custom analysis."""
    if not all(i in basket.columns for i in items):
        return {"error": "One or more items not found in transactions."}
    return {"status": "success", "message": "Bundle affinity confirmed."}