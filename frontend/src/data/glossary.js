/**
 * OPTIMA — Shared Glossary / Term Dictionary
 *
 * This is the single source of truth for all term definitions in the app.
 * It powers both:
 *   1. The Help Center → Glossary tab  (/help)
 *   2. Every <InfoTooltip term="..." /> across all pages
 *
 * Fields:
 *   term        — The exact technical label used in the UI
 *   plain       — A friendlier, plain-English equivalent (optional)
 *   category    — Groups terms for filtering in the Glossary page
 *   definition  — Full plain-English definition (1–3 sentences)
 *   example     — Optional concrete example to aid understanding
 *   usedIn      — Pages/sections where this term appears (for "Used in" links)
 */

export const GLOSSARY_CATEGORIES = [
  'All',
  'Forecasting',
  'Bundle Analysis',
  'Data & Training',
  'Statistics',
  'Retail & Merchandising',
  'Navigation',
  'System',
];

export const GLOSSARY = [

  // ─── FORECASTING ──────────────────────────────────────────────────────────

  {
    term: 'ERROR PERCENTAGE',
    plain: 'Relative Accuracy Score',
    aliases: ['MAPE', 'Error Percentage'],
    category: 'Forecasting',
    definition:
      'Measures on average how far off the forecast is from actual sales, expressed as a percentage. A lower value means our predictions are closer to real sales numbers.',
    example: 'An Error Percentage of 8% means predictions are off by about 8 items for every 100 items sold.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'AVG. ERROR MAGNITUDE',
    plain: 'Typical Unit Variance',
    aliases: ['MAE', 'Avg. Error Magnitude', 'Average Error'],
    category: 'Forecasting',
    definition:
      'The typical difference in unit quantity between our forecast and actual sales. It tells you how many units a prediction typically deviates on an average day or month.',
    example: 'An Avg. Error Magnitude of 12 means predictions typically deviate by roughly 12 units.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'PEAK ERROR SENSITIVITY',
    plain: 'Anomaly Detection Metric',
    aliases: ['RMSE', 'Peak Error Sensitivity'],
    category: 'Forecasting',
    definition:
      'A statistical measure that highlights whether a model occasionally makes large prediction errors during demand spikes, promotions, or unexpected supply disruptions.',
    example: 'If Peak Error Sensitivity is much higher than Avg. Error Magnitude, it means sales experienced sudden unusual spikes.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'SALES SIGNAL BREAKDOWN',
    plain: 'Trend & Seasonality Breakdown',
    aliases: ['STL Decomposition', 'STL', 'Trend Breakdown', 'Decomposition'],
    category: 'Forecasting',
    definition:
      'Our analytical engine separates your historical sales data into three core drivers: long-term sales trajectory, recurring seasonal cycles, and unexplained market fluctuations.',
    example: 'This breakdown might reveal that a product consistently spikes in December (seasonal cycle) while maintaining steady 10% year-over-year growth (long-term trajectory).',
    usedIn: ['Forecasting'],
  },
  {
    term: 'DEEP LEARNING ENGINE',
    plain: 'Advanced Pattern Recognition',
    aliases: ['DeepAR', 'Deep Learning Engine', 'AI Forecaster'],
    category: 'Forecasting',
    definition:
      'Our neural network forecasting model that learns demand patterns across your entire catalog simultaneously, predicting how products react to seasons, growth trends, and promotions.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'HYBRID FORECASTING MODEL',
    plain: 'Multi-Method Prediction Engine',
    aliases: ['Hybrid Model', 'Hybrid Forecaster', 'Forecaster', 'Hybrid'],
    category: 'Forecasting',
    definition:
      'Our prediction engine combines deep neural networks with statistical signal breakdown and automatic error correction to deliver highly reliable 12-month demand predictions.',
    usedIn: ['Data & Training', 'Forecasting'],
  },
  {
    term: 'Forecast Horizon',
    category: 'Forecasting',
    definition:
      'How far into the future the model predicts. Optima generates a 12-month forecast horizon — meaning predictions extend 12 months beyond the last available sales data.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Confidence Interval',
    plain: 'Prediction Range',
    category: 'Forecasting',
    definition:
      'The shaded band on the forecast chart. It represents the range within which actual future sales are likely to fall. A wider band means the model is less certain; a narrower band means higher confidence.',
    example: 'If the forecast is 500 units with a confidence interval of 420–580, actual sales will most likely land somewhere in that range.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Global Baseline',
    plain: 'Store-Wide Forecast',
    category: 'Forecasting',
    definition:
      'An aggregate forecast that combines all products in the dataset into a single store-wide demand signal. Useful for understanding overall business trajectory before diving into individual products.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Trend Status',
    category: 'Forecasting',
    definition:
      'A classification of a product\'s sales direction over time. Optima assigns one of: GROWTH (sales are increasing), DECLINE (sales are decreasing), STAGNANT (sales are flat or erratic with no clear direction), or SEASONAL (demand is cyclical).',
    usedIn: ['Forecasting'],
  },
  {
    term: 'STAGNANT TREND',
    plain: 'Stagnant / Inactive Product',
    aliases: ['Stagnant Trend', 'Zombie Product', 'Zombie', 'Stagnant'],
    category: 'Forecasting',
    definition:
      'This product shows flat, near-zero, or erratic historical demand without a consistent growth trajectory. We recommend reviewing pricing or creating promotional bundles to reactivate sales.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'MODEL HEALTH',
    plain: 'Demand Predictability Index',
    aliases: ['Model Health'],
    category: 'Forecasting',
    definition:
      'An overall indicator of how reliably future demand can be predicted. Healthy items follow consistent seasonal or growth cycles, while stagnant items exhibit flat or erratic sales.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'HEALTHY TREND',
    plain: 'Reliable Demand Pattern',
    aliases: ['Healthy Trend', 'Healthy'],
    category: 'Forecasting',
    definition:
      'This product exhibits clear, consistent historical sales patterns and reliable seasonal demand cycles. Forecast predictions for this item have high confidence.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'YoY',
    plain: 'Year-Over-Year Comparison',
    category: 'Forecasting',
    definition:
      'Year-over-Year. Compares this period\'s forecasted demand against the same period in a prior year. Used to identify whether demand is growing, shrinking, or staying flat relative to historical patterns.',
    example: 'If last year\'s December was 1,200 units and this year\'s forecast is 1,450, that\'s a +21% YoY increase.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Year-over-Year Growth Rate',
    plain: 'YoY Growth Rate / Delta Variance',
    category: 'Forecasting',
    definition:
      'The percentage and absolute unit difference between the current forecast and the historical benchmark for the same period. A positive delta means demand is expected to grow; negative means it is expected to fall.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Outperforming Past Sales',
    plain: 'Exceeding Baseline',
    category: 'Forecasting',
    definition:
      'Indicates that the predicted sales volume for the forecast period is higher than the historical benchmark from prior years.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'FORECAST ALIGNMENT',
    plain: 'Future Demand Prediction Compatibility',
    aliases: ['Forecast Alignment'],
    category: 'Forecasting',
    definition:
      'A statistical score indicating whether predicted future demand for both items is rising or falling in sync. Strong alignment ensures you won\'t run out of stock on one item while overstocking the other.',
    usedIn: ['Bundle Analysis', 'Forecasting'],
  },
  {
    term: 'TREND MOMENTUM',
    plain: 'Growth Acceleration Rate',
    aliases: ['Trend Momentum', 'Trend Slope'],
    category: 'Forecasting',
    definition:
      'The speed at which sales growth is accelerating or slowing down over time. Positive momentum means customer demand is building rapidly.',
    usedIn: ['Bundle Analysis', 'Forecasting'],
  },
  {
    term: 'SEASONAL INFLUENCE',
    plain: 'Time-of-Year Sensitivity',
    aliases: ['Seasonal Weight', 'Seasonal Influence'],
    category: 'Forecasting',
    definition:
      'A percentage score showing how heavily sales depend on repeating holiday or annual seasonal cycles. A high influence means promotions should be carefully timed to match seasonal peaks.',
    usedIn: ['Bundle Analysis', 'Forecasting'],
  },

  // ─── BUNDLE ANALYSIS ──────────────────────────────────────────────────────

  {
    term: 'SYNERGY BOOST',
    plain: 'Historical Co-Purchase Strength',
    aliases: ['Lift', 'Synergy Boost (Lift)', 'Synergy Boost'],
    category: 'Bundle Analysis',
    definition:
      'Measures how much more likely two products are to be purchased together compared to random chance. A value above 1.0x indicates a strong positive relationship between the items.',
    example: 'A Synergy Boost of 2.5x means customers are 2.5 times more likely to buy both items together than if the products were unrelated.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'CO-PURCHASE RATE',
    plain: 'Pairing Reliability',
    aliases: ['Confidence', 'Co-Purchase Rate (Confidence)', 'Co-Purchase Rate'],
    category: 'Bundle Analysis',
    definition:
      'The percentage of transactions containing Product A that also contain Product B. A high rate means customers who buy the first item consistently buy the second.',
    example: 'A Co-Purchase Rate of 72% means that in 72 out of 100 transactions where Product A was purchased, Product B was also purchased.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'PURCHASE FREQUENCY',
    plain: 'Overall Basket Popularity',
    aliases: ['Support', 'Purchase Frequency (Support)', 'Purchase Frequency'],
    category: 'Bundle Analysis',
    definition:
      'The percentage of all recorded transactions that contain both products together. Tells you how common a pairing is across your entire business.',
    example: 'A Purchase Frequency of 3.5% means the pair appears together in 3.5% of all recorded transactions.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'PATTERN MINING ENGINE',
    plain: 'Co-Purchase Discovery',
    aliases: ['Apriori Algorithm', 'Apriori', 'Pattern Mining Engine'],
    category: 'Bundle Analysis',
    definition:
      'Our automated discovery engine that scans your historical sales logs to identify which products are most frequently purchased together.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Association Rule Mining',
    plain: 'Co-Purchase Discovery',
    category: 'Bundle Analysis',
    definition:
      'A technique for discovering interesting relationships between items in large transaction datasets. Optima applies this to identify which products tend to be purchased together, and how strong and reliable those relationships are.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'AI RANKING ENGINE',
    plain: 'Multi-Factor Scoring',
    aliases: ['Random Forest', 'AI Ranking Engine'],
    category: 'Bundle Analysis',
    definition:
      'Our advanced scoring model that evaluates synergy boost, co-purchase rate, and future forecast signals to rank and categorize product bundles.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Product Pairing Insights',
    plain: 'Product Pairing Insights',
    category: 'Navigation',
    definition:
      'The view in the Product Bundler that displays all recommended product pairings from a saved bundling run. Each entry shows the pair, its statistical scores (Synergy Boost, Co-Purchase Rate, Purchase Frequency), and its category badge.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Test a Pair',
    plain: 'Test a Pair',
    category: 'Navigation',
    definition:
      'A tool that lets you manually select any two products and instantly calculate their bundle statistics without running a full model. Useful for testing a specific hypothesis before committing to a strategy.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Choose Two Items',
    plain: 'Manual Pair Test',
    category: 'Bundle Analysis',
    definition:
      'When using the Affinity Simulator, a "bundle hypothesis" is your proposed pairing of two products. The system evaluates whether historical data supports the idea that these products should be bundled together.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'TOP SYNERGY BUNDLE',
    plain: 'Consistently Strong Performer',
    aliases: ['STRATEGIC', 'TOP SYNERGY', 'TOP SYNERGY (STRATEGIC)', 'Top Synergy Bundle', 'Strategic Badge', 'Bundle Category'],
    category: 'Bundle Analysis',
    definition:
      'This specific product pair has strong, consistent historical co-purchase patterns and good forecast alignment. These are our highest-confidence recommendations for promotions or joint merchandising.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'RISING TREND BUNDLE',
    plain: 'Growing Opportunity',
    aliases: ['EMERGING', 'RISING TREND', 'RISING TREND (EMERGING)', 'Rising Trend Bundle', 'Growing Potential'],
    category: 'Bundle Analysis',
    definition:
      'This product pair shows a rising co-purchase trend. While not yet as established as Top Synergy bundles, customer interest is growing rapidly—making it an ideal candidate for promotional testing.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'POTENTIAL MATCH',
    plain: 'Cross-Selling Opportunity',
    aliases: ['OPPORTUNITY', 'POTENTIAL MATCH (OPPORTUNITY)', 'Potential Match Bundle'],
    category: 'Bundle Analysis',
    definition:
      'This product pair shows solid historical co-purchase association with stable demand. A great candidate for standard bundling or cross-selling.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'TIME-DEPENDENT BUNDLE',
    plain: 'Seasonal Association',
    aliases: ['SEASONAL', 'Time-Dependent Bundle', 'Seasonal Opportunity'],
    category: 'Bundle Analysis',
    definition:
      'This product pair\'s co-purchase frequency is driven by specific seasons or time periods. Promotional campaigns for these items should be timed to match peak seasonal demand.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'LOW SYNERGY PAIR',
    plain: 'Unlikely Opportunity',
    aliases: ['RISK', 'Low-Confidence Bundle', 'Low Synergy'],
    category: 'Bundle Analysis',
    definition:
      'This product pair shows weak historical co-purchase reliability or conflicting demand signals. We recommend avoiding joint promotions for these items.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Save to Vault',
    plain: 'Save to Vault',
    category: 'Navigation',
    definition:
      'The action of permanently saving a sandboxed bundle result to the Strategy Vault so it can be referenced later. Until committed, the results are only visible in the current session.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Strategy Vault',
    plain: 'Saved Bundle Records',
    category: 'Navigation',
    definition:
      'The saved collection of committed bundling run results. You can load any previously saved strategy from the vault and review its product pairs, scores, and rationale.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Strategic Rationale',
    plain: 'Why This Bundle Was Recommended',
    category: 'Bundle Analysis',
    definition:
      'A human-readable explanation generated by the model for why a specific product pair was recommended. It summarizes the statistical evidence and any trend or seasonal factors that influenced the score.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Probability',
    plain: 'Bundle Success Score',
    category: 'Bundle Analysis',
    definition:
      'A 0–100% score assigned to each bundle representing the model\'s confidence that this pairing will succeed as a promoted combination. Derived from Lift, Confidence, Support, and forecast signals.',
    usedIn: ['Bundle Analysis'],
  },

  // ─── DATA & TRAINING ──────────────────────────────────────────────────────

  {
    term: 'Data Ingestion',
    plain: 'Uploading Your Data',
    category: 'Data & Training',
    definition:
      'The process of uploading your sales transaction files (CSV or Excel) into Optima. During ingestion, the system scans the files, identifies all product names, and prepares the data for model training.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Master Dataset',
    plain: 'Combined Sales History',
    category: 'Data & Training',
    definition:
      'A dataset formed by merging multiple partial or yearly datasets into one continuous record. Used as the primary data source when training models that need a full historical picture.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Transaction Records',
    plain: 'Sales Entries',
    category: 'Data & Training',
    definition:
      'Individual rows in the uploaded dataset, each representing a single product sale at a specific date. The quality and quantity of transaction records directly affects model accuracy.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Min Support',
    plain: 'Minimum Pairing Frequency',
    category: 'Data & Training',
    definition:
      'The minimum percentage of transactions a product pair must appear in before the Bundler will consider it a valid recommendation. Set this higher to get only the most common pairings; lower to surface rare but potentially interesting ones.',
    example: 'A Min Support of 2% means a pair must appear together in at least 2% of all transactions to be included.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Bundle Flag',
    plain: 'Mark as Bundleable',
    category: 'Data & Training',
    definition:
      'An item-level setting applied during data ingestion that tells the Bundler to include this product in co-purchase analysis. Items without this flag are still used in forecasting but excluded from bundle recommendations.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Exclude Flag',
    plain: 'Exclude from Analysis',
    category: 'Data & Training',
    definition:
      'An item-level setting that tells Optima this entry is not a product (e.g., a service fee, discount code, or internal tracking entry) and should be excluded from all forecasting and bundling.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Forecast Run',
    plain: 'Saved Forecast Result',
    category: 'Data & Training',
    definition:
      'A named record of a completed forecasting session. Each run stores the model configuration, the 12-month predictions for all selected products, and accuracy metrics. You can open and compare past runs at any time.',
    usedIn: ['Forecasting', 'Data & Training'],
  },
  {
    term: 'Bundler Run',
    plain: 'Saved Bundle Result',
    category: 'Data & Training',
    definition:
      'A named record of a completed product bundling session. Each run stores the set of recommended product pairs and their scores. Runs can be committed to the Strategy Vault for future reference.',
    usedIn: ['Bundle Analysis', 'Data & Training'],
  },
  {
    term: 'Ref Forecast',
    plain: 'Reference Forecast',
    category: 'Data & Training',
    definition:
      'An optional link between a Bundler run and an existing Forecast run. When provided, the Bundler uses the forecast\'s demand signals to improve bundle scoring — weighting pairs higher if both products are predicted to sell well.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Aggregated Data',
    plain: 'Summarized Sales by Period',
    category: 'Data & Training',
    definition:
      'A view of your transaction data grouped by time period (e.g., monthly totals per product), rather than individual transaction rows. Optima uses aggregated data internally for model training.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Model Training',
    plain: 'Running the Models',
    category: 'Data & Training',
    definition:
      'The process of running the selected forecasting or bundling model against your dataset. Training can take several minutes depending on the number of products and the length of the historical record.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Forecaster',
    plain: 'Demand Prediction Engine',
    category: 'Data & Training',
    definition:
      'The advanced model that analyzes your transaction history to generate 12-month demand predictions for each product. It uses a hybrid of deep learning and statistical decomposition to identify trends and seasonality.',
    usedIn: ['Data & Training', 'Forecasting'],
  },
  {
    term: 'Bundler',
    plain: 'Co-Purchase Analyzer',
    category: 'Data & Training',
    definition:
      'The engine that mines your sales data for product affinities. It identifies which products are frequently bought together and scores them based on statistical reliability to recommend strategic product bundles.',
    usedIn: ['Data & Training', 'Bundle Analysis'],
  },
  {
    term: 'Sandbox',
    plain: 'Preview Mode',
    category: 'Data & Training',
    definition:
      'A temporary preview state for bundle results before they are saved. In sandbox mode, you can review results and decide whether to commit them to the Strategy Vault or discard them.',
    usedIn: ['Bundle Analysis'],
  },

  // ─── STATISTICS ───────────────────────────────────────────────────────────

  {
    term: 'Time Series',
    category: 'Statistics',
    definition:
      'A sequence of data points recorded over time at regular intervals (e.g., monthly sales figures). Forecasting models are specifically designed to analyze time series data and predict future values.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'RECURRING SEASONAL PATTERNS',
    plain: 'Cyclical Demand Swings',
    aliases: ['Seasonality', 'Seasonal Component', 'Seasonal', 'Seasonal Fluctuations', 'Seasonal Weight'],
    category: 'Statistics',
    definition:
      'Repeating demand surges or dips that occur at the same time each year—such as holiday spikes or off-season lulls. Our models separate these cycles so you can prepare inventory in advance.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'LONG-TERM SALES DIRECTION',
    plain: 'Underlying Growth or Decline',
    aliases: ['Trend', 'Trend Component', 'Long-Term Trend', 'Trend Momentum'],
    category: 'Statistics',
    definition:
      'The true trajectory of a product\'s demand over time, independent of seasonal swings or random daily bumps. Tells you whether your product is steadily growing, declining, or holding stable.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'UNEXPLAINED FLUCTUATIONS',
    plain: 'Market Noise & Anomalies',
    aliases: ['Remainder', 'Residual', 'Remainder Component', 'Noise'],
    category: 'Statistics',
    definition:
      'The random day-to-day variance in sales that cannot be explained by underlying trends or seasonal cycles. Large spikes here usually indicate one-off events, unexpected bulk orders, or stockouts.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'ACTUAL RECORDED SALES',
    plain: 'Raw Historical Transactions',
    aliases: ['Observed', 'Observed Component', 'Observed Sales'],
    category: 'Statistics',
    definition:
      'Your actual historical sales volume exactly as recorded in your transaction logs, before our analytical engine isolates underlying growth trends and seasonal cycles.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Benchmark',
    category: 'Statistics',
    definition:
      'A reference point used for comparison. In Optima, benchmarking compares the current forecast against the same product\'s actual performance in a previous year to assess growth or decline.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Outlier',
    category: 'Statistics',
    definition:
      'A data point that is significantly different from the rest of the dataset. Outliers can distort model training and may indicate data entry errors, one-time events, or exceptional promotions.',
  },
  {
    term: 'Correlation',
    category: 'Statistics',
    definition:
      'A statistical measure of how closely two variables move together. In bundle analysis, high correlation between two products means they tend to be purchased at similar times.',
  },

  // ─── RETAIL & MERCHANDISING ───────────────────────────────────────────────

  {
    term: 'SKU',
    plain: 'Product Code',
    category: 'Retail & Merchandising',
    definition:
      'Stock Keeping Unit. A unique identifier assigned to each distinct product or product variant in inventory. In Optima, each product name in your dataset effectively acts as a SKU.',
  },
  {
    term: 'Demand Forecasting',
    category: 'Retail & Merchandising',
    definition:
      'The process of predicting how much of a product customers will buy in the future, based on historical sales patterns, trends, and seasonality. Accurate demand forecasting reduces both stockouts and excess inventory.',
  },
  {
    term: 'Cross-Selling',
    category: 'Retail & Merchandising',
    definition:
      'A sales strategy of recommending complementary products to a customer who is already buying something. Example: suggesting a phone case to someone buying a phone. Optima\'s bundle recommendations support cross-selling strategies.',
  },
  {
    term: 'Upselling',
    category: 'Retail & Merchandising',
    definition:
      'A sales strategy of encouraging a customer to purchase a more expensive or premium version of what they are considering. Different from cross-selling, which promotes additional complementary items.',
  },
  {
    term: 'Market Basket Analysis',
    plain: 'Co-Purchase Analysis',
    category: 'Retail & Merchandising',
    definition:
      'The study of which products tend to be bought together in the same transaction. It is the foundation of product bundling strategy. Optima automates this analysis using association rule mining.',
  },
  {
    term: 'Product Velocity',
    plain: 'Sales Speed',
    category: 'Retail & Merchandising',
    definition:
      'How quickly a product sells. High-velocity products move fast and need frequent restocking. Low-velocity products sell slowly and may require bundling or promotions to accelerate clearance.',
  },
  {
    term: 'Slow-Moving Inventory',
    category: 'Retail & Merchandising',
    definition:
      'Products that sell at a much slower rate than expected or desired. These tie up capital and warehouse space, and are candidates for markdowns, bundles, or discontinuation.',
  },
  {
    term: 'Dead Stock',
    category: 'Retail & Merchandising',
    definition:
      'Inventory that has not sold for a prolonged period and is unlikely to sell at full price. Dead stock represents a loss and often requires heavy markdowns or write-offs.',
  },
  {
    term: 'Stockout',
    category: 'Retail & Merchandising',
    definition:
      'When a product runs out of stock and cannot meet customer demand. Stockouts lead to lost sales and customer dissatisfaction. Accurate demand forecasting helps prevent stockouts.',
  },
  {
    term: 'Markdown',
    category: 'Retail & Merchandising',
    definition:
      'A reduction in a product\'s selling price, often used to clear slow-moving or excess inventory. Markdowns are a common tool for managing product lifecycle.',
  },
  {
    term: 'Planogram',
    category: 'Retail & Merchandising',
    definition:
      'A visual diagram or plan for how products should be displayed on store shelves. Bundle insights from Optima can inform planogram decisions — placing frequently co-purchased items near each other to increase basket size.',
  },
  {
    term: 'Category Management',
    category: 'Retail & Merchandising',
    definition:
      'The practice of managing groups of related products (categories) as strategic business units. Optima\'s analytics and bundle recommendations support category management by identifying which products within a category drive the most value.',
  },
  {
    term: 'Basket Size',
    plain: 'Average Items Per Transaction',
    category: 'Retail & Merchandising',
    definition:
      'The average number of products purchased in a single transaction. Effective bundling strategies typically increase basket size by encouraging customers to add complementary items.',
  },
  {
    term: 'Point of Sale (POS)',
    plain: 'Sales Transaction System',
    category: 'Retail & Merchandising',
    definition:
      'The system used to record and process customer transactions. POS data — the history of what was sold, when, and in what quantities — is the primary input for Optima\'s forecasting and bundling models.',
  },
  {
    term: 'Promotional Lift',
    category: 'Retail & Merchandising',
    definition:
      'The increase in sales of a product (or bundle) attributable to a promotion or marketing activity, above what would have been sold without it. Optima\'s Lift metric in bundle scoring is related to, but distinct from, promotional lift.',
  },
  {
    term: 'Inventory Turnover',
    category: 'Retail & Merchandising',
    definition:
      'How many times a product\'s inventory is sold and replaced over a given period. High turnover indicates strong demand; low turnover suggests the product may need promotion or reconsideration.',
  },
  {
    term: 'Replenishment',
    category: 'Retail & Merchandising',
    definition:
      'The process of restocking products to meet anticipated demand. Demand forecasts from Optima can directly inform replenishment decisions — ordering more of high-growth products and less of declining ones.',
  },
  {
    term: 'Shrinkage',
    category: 'Retail & Merchandising',
    definition:
      'Inventory loss due to theft, damage, spoilage, or administrative errors. Shrinkage is not captured in transaction data and can affect the accuracy of demand models if not accounted for.',
  },
  {
    term: 'Conversion Rate',
    category: 'Retail & Merchandising',
    definition:
      'The percentage of customer interactions (store visits, website sessions, etc.) that result in a purchase. Bundle promotions are often designed to increase conversion by reducing purchase hesitation.',
  },
  {
    term: 'Assortment Planning',
    category: 'Retail & Merchandising',
    definition:
      'The process of deciding which products to stock, in what quantities, and for which time periods. Demand forecasts and bundle insights from Optima can inform assortment decisions.',
  },

  // ─── NAVIGATION ───────────────────────────────────────────────────────────

  {
    term: 'Management Hub',
    plain: 'Data & Model Control Center',
    category: 'Navigation',
    definition:
      'The main workspace for uploading data, configuring products, and launching model training runs. This is the starting point for every Optima workflow.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Forecasting',
    plain: 'Analytics & Predictions',
    category: 'Navigation',
    definition:
      'The page where you view saved forecast runs, explore product-level predictions, and compare performance against historical benchmarks.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Product Bundler',
    plain: 'Bundle Strategy Page',
    category: 'Navigation',
    definition:
      'The page dedicated to discovering and testing product bundling strategies. Contains the Discovery Matrix (saved runs) and Affinity Simulator (manual pair testing).',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Saved Forecasts',
    plain: 'Saved Forecasts',
    category: 'Navigation',
    definition:
      'The library of all previously completed and saved forecast runs. Each card shows the run name, creation date, and number of products analyzed. Click any card to open its detailed results.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Train Models',
    plain: 'Model Training',
    category: 'Navigation',
    definition:
      'The section within the Management Hub where you configure and launch model training. You select datasets, choose which models to run (Forecaster, Bundler, or both), and name the run.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Run History',
    plain: 'Run History',
    category: 'Navigation',
    definition:
      'The listing of all saved forecast runs, used as the entry point into the Forecasting page. Selecting a run opens its detailed charts and metrics.',
    usedIn: ['Forecasting'],
  },

  // ─── SYSTEM ───────────────────────────────────────────────────────────────

  {
    term: 'Active Dataset',
    category: 'System',
    definition:
      'The dataset currently selected as the primary data source for the session. Other pages (like Product Bundler) use the active dataset as their default context.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Audit Trail',
    plain: 'Admin Action Log',
    category: 'System',
    definition:
      'A chronological record of all administrative actions taken in the system — such as user approvals, role changes, and bans. Visible only to admins.',
    usedIn: ['System'],
  },
  {
    term: 'Session Log',
    plain: 'Login History',
    category: 'System',
    definition:
      'A record of every login session across all users, including login/logout times and session duration. Admins can force-end active sessions if needed.',
    usedIn: ['System'],
  },
  {
    term: 'Registration Queue',
    plain: 'Pending User Approvals',
    category: 'System',
    definition:
      'New users who have registered but are awaiting admin approval before they can access the system. Admins can approve or deny each request from the Admin Panel.',
    usedIn: ['System'],
  },
];

/**
 * Helper: look up a single term by its exact name (case-insensitive).
 * Used by <InfoTooltip term="Lift" /> to fetch the definition.
 */
export function lookupTerm(termName) {
  if (!termName) return null;
  const target = termName.toLowerCase().trim();
  
  // 1. Exact match on term, plain, or aliases
  const exact = GLOSSARY.find(
    (entry) => entry.term.toLowerCase() === target || 
               (entry.plain && entry.plain.toLowerCase() === target) ||
               (entry.aliases && entry.aliases.some(a => a.toLowerCase() === target))
  );
  if (exact) return exact;

  // 2. Substring / partial match
  return GLOSSARY.find(
    (entry) => entry.term.toLowerCase().includes(target) || 
               (entry.plain && entry.plain.toLowerCase().includes(target)) ||
               (entry.aliases && entry.aliases.some(a => a.toLowerCase().includes(target)))
  ) || null;
}
