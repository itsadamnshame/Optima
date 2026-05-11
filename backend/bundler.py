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
        
        if df_raw.empty:
            return []
        
        # Load Metadata early to filter discontinued items
        query_meta = text("SELECT ItemDescription, availability_status, availability_type, is_bundle FROM item_metadata WHERE dataset_id = :d")
        with engine.connect() as conn:
            meta_rows = conn.execute(query_meta, {"d": dataset_id}).fetchall()
        
        item_meta = {r[0]: {"status": r[1], "type": r[2], "is_bundle": bool(r[3]) if len(r) > 3 else False} for r in meta_rows}
        
        # Filter out discontinued items from transactions
        available_items = {item for item, meta in item_meta.items() if meta['status'] != 'discontinued'}
        df_raw = df_raw[df_raw['ItemDescription'].isin(available_items)].copy()
        
        if df_raw.empty:
            print("BUNDLER: No available items after filtering discontinued products.")
            return []

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
        # Cache check: We only need to build item_metrics once per process/dataset if possible, 
        # but for simplicity here we'll just optimize the query.
        print(f"BUNDLER: Starting Phase 2 (Contextual Metrics)... Ref: {forecast_run_id}")
        
        item_metrics = {}
        if forecast_run_id:
            # Load Forecast Results for metrics (Optimized: Get only what we need)
            query_forecast = text("SELECT item_description, result_json FROM forecast_results WHERE run_id = :rid")
            with engine.connect() as conn:
                forecast_rows = conn.execute(query_forecast, {"rid": forecast_run_id}).fetchall()
            
            for row in forecast_rows:
                item_name = row[0]
                data = json.loads(row[1])
                meta = data.get('meta', {}).get('metrics', {})
                
                # Extract Trend Slope
                trend = meta.get('stl', {}).get('trend', [])
                slope = 0
                if len(trend) >= 3:
                    slope = (trend[-1] - trend[-3]) / 3
                
                # Extract Seasonality Weight
                seasonal = meta.get('stl', {}).get('seasonal', [])
                seasonal_weight = 0
                if seasonal:
                    max_s = max(seasonal) if max(seasonal) != 0 else 1
                    seasonal_weight = (seasonal[-1] / max_s) * 10
                
                # Forecast Volume
                forecast_df = pd.DataFrame(data.get('data', []))
                forecast_score = forecast_df['yhat'].tail(12).sum() if 'yhat' in forecast_df.columns else 0

                item_metrics[item_name] = {
                    "forecast_score": forecast_score,
                    "trend_slope": slope,
                    "seasonal_weight": seasonal_weight
                }
        else:
            print("BUNDLER: No forecast reference provided. Skipping Phase 2 metrics.")

        # Build Bundle Features
        candidates = []
        for _, row in rules.iterrows():
            item_a = row['antecedents']
            item_b = row['consequents']
            
            # Exclude bundles from being bundled (circular prevention)
            meta_a = item_meta.get(item_a, {})
            meta_b = item_meta.get(item_b, {})
            
            if meta_a.get('is_bundle') or meta_b.get('is_bundle'):
                continue  # Skip this pair if either is a bundle/set
            
            # Check if both items exist in metrics
            m_a = item_metrics.get(item_a, {"forecast_score": 0, "trend_slope": 0, "seasonal_weight": 0})
            m_b = item_metrics.get(item_b, {"forecast_score": 0, "trend_slope": 0, "seasonal_weight": 0})

            # Combined Score Features
            avg_forecast = (m_a['forecast_score'] + m_b['forecast_score']) / 2
            avg_slope = (m_a['trend_slope'] + m_b['trend_slope']) / 2
            avg_seasonal = (m_a['seasonal_weight'] + m_b['seasonal_weight']) / 2
            
            # Metadata Flags (One-hot logic)
            is_available = 1 if (meta_a.get('status') == 'available' and meta_b.get('status') == 'available') else 0
            is_always = 1 if (meta_a.get('type') == 'always' or meta_b.get('type') == 'always') else 0

            candidates.append({
                "item_a": item_a,
                "item_b": item_b,
                "lift": row['lift'],
                "support": row['support'],
                "confidence": row['confidence'],
                "forecast_score": avg_forecast,
                "trend_slope": avg_slope,
                "seasonal_weight": avg_seasonal,
                "is_available": is_available,
                "is_always": is_always
            })

        if not candidates:
            return []

        # --- PHASE 3: THE RANKING STAGE (RANDOM FOREST) ---
        print("BUNDLER: Starting Phase 3 (Random Forest Ranking)...")
        df_candidates = pd.DataFrame(candidates)
        
        # Features for RF
        X = df_candidates[['lift', 'support', 'confidence', 'forecast_score', 'trend_slope', 'seasonal_weight', 'is_available', 'is_always']]
        
        # Synthetic Training: Define "Success" as high Lift AND High Available AND Rising Trend
        # In a production system, this would be trained on historical bundle revenue.
        # Here we simulate the RF acting as a "weighted judge" as requested.
        def calculate_success_label(r):
            score = (r['lift'] * 2) + (r['is_available'] * 10) + (r['trend_slope'] * 5) + (r['seasonal_weight'] * 2)
            return 1 if score > np.percentile([ (c['lift']*2 + c['is_available']*10 + c['trend_slope']*5 + c['seasonal_weight']*2) for c in candidates ], 70) else 0

        y = df_candidates.apply(calculate_success_label, axis=1)
        
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X, y)
        
        # Robust proba extraction (check if we have both classes)
        if len(rf.classes_) > 1:
            probs = rf.predict_proba(X)[:, 1]
        else:
            # Fallback to confidence if model only sees one class
            probs = X['confidence'].values

        rules['strategic_score'] = probs
        df_candidates['probability'] = probs
        df_candidates = df_candidates.sort_values(by='probability', ascending=False)

        # --- PHASE 4: INTEGRATION (BADGES) ---
        print("BUNDLER: Finalizing Phase 4 (Contextual Badges)...")
        results = []
        for i, (_, row) in enumerate(df_candidates.iterrows()):
            badge = "OPPORTUNITY"
            reason = "Solid historical association with stable demand."
            
            if row['probability'] > 0.8:
                badge = "STRATEGIC"
                reason = "High historical Lift combined with Rising Trends and Seasonal Peaks."
            elif row['is_available'] == 0:
                badge = "RISK"
                reason = "Strong historical link but one item is currently Unavailable."
            elif row['trend_slope'] > 0.5:
                badge = "EMERGING"
                reason = "Rapidly growing demand for both items in recent months."
            elif row['seasonal_weight'] > 7:
                badge = "SEASONAL"
                reason = "Both items entering peak seasonal cycle next month."

            results.append({
                "rank": i + 1,
                "pair": f"{row['item_a']} + {row['item_b']}",
                "lift": round(row['lift'], 2),
                "confidence": round(row['confidence'], 2),
                "support": round(row['support'], 4),
                "forecast_score": round(row['forecast_score'], 2),
                "trend_slope": round(row['trend_slope'], 3),
                "seasonal_weight": round(row['seasonal_weight'], 2),
                "is_available": bool(row['is_available']),
                "is_always": bool(row['is_always']),
                "probability": round(row['probability'] * 100, 1),
                "badge": badge,
                "why": reason
            })

        # Save to DB if requested
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
        # 1. Quick Stats (Lift/Confidence)
        query = text("""
            SELECT "CustomerID", "ItemDescription" 
            FROM sales_transactions 
            WHERE dataset_id IN :dataset_ids
            AND "ItemDescription" IN (:ia, :ib)
        """).bindparams(bindparam("dataset_ids", expanding=True))
        df_raw = pd.read_sql(query, engine, params={"dataset_ids": dataset_ids, "ia": item_a, "ib": item_b})
        
        if df_raw.empty:
            return {"pair": f"{item_a} + {item_b}", "probability": 0, "badge": "NONE", "why": "No transaction history found."}

        # Basic Affinity Calculation
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

        # 2. Forecasting Context (Phase 2 Logic)
        item_metrics = {}
        if forecast_run_id:
            query_forecast = text("SELECT item_description, result_json FROM forecast_results WHERE run_id = :rid AND item_description IN (:ia, :ib)")
            with engine.connect() as conn:
                forecast_rows = conn.execute(query_forecast, {"rid": forecast_run_id, "ia": item_a, "ib": item_b}).fetchall()
            
            for row in forecast_rows:
                item_name = row[0]
                data = json.loads(row[1])
                # Simplified metrics for simulation
                item_metrics[item_name] = {
                    "is_rising": data.get("trend") == "UP",
                    "seasonal_peaks": data.get("peaks", [])
                }

        # 3. Strategic Rationale
        reasons = []
        if lift > 2: reasons.append("High historical Lift")
        if confidence > 0.5: reasons.append("Strong purchase confidence")
        
        badge = "STRATEGIC"
        if item_metrics.get(item_a, {}).get("is_rising") and item_metrics.get(item_b, {}).get("is_rising"):
            badge = "EMERGING"
            reasons.append("Both items show rising demand trends")
        
        # Simplified probability for simulation
        prob = (confidence * 0.4 + (min(lift, 10)/10) * 0.4 + (0.2 if badge == "EMERGING" else 0.1)) * 100
        
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
