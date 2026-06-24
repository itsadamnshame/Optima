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
    term: 'MAPE',
    plain: 'Forecast Accuracy',
    category: 'Forecasting',
    definition:
      'Mean Absolute Percentage Error. Measures on average how far off the forecast is from actual sales, expressed as a percentage. A lower MAPE means the model is more accurate.',
    example: 'A MAPE of 8% means the forecast is off by about 8 units for every 100 units actually sold.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'MAE',
    plain: 'Average Error',
    category: 'Forecasting',
    definition:
      'Mean Absolute Error. The average absolute difference between the forecasted value and the actual value, in the same units as the data. It tells you how big the typical error is.',
    example: 'An MAE of 12 means the forecast is off by about 12 units on a typical day.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'RMSE',
    plain: 'Peak Error Sensitivity',
    category: 'Forecasting',
    definition:
      'Root Mean Square Error. Similar to MAE but penalizes large errors more heavily. A high RMSE relative to MAE means the model occasionally makes very large mistakes — usually during spikes or unusual events.',
    example: 'If RMSE is much higher than MAE, the model struggled during a promotional period.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'STL Decomposition',
    plain: 'Trend Breakdown',
    category: 'Forecasting',
    definition:
      'Seasonal-Trend-Loess Decomposition. A technique that separates a sales time series into three components: the overall trend, repeating seasonal patterns, and random noise (remainder). Helps identify what is driving sales changes.',
    example: 'STL might reveal that a product always spikes in December (seasonal) and has been slowly growing year over year (trend).',
    usedIn: ['Forecasting'],
  },
  {
    term: 'DeepAR',
    plain: 'AI Forecasting Model',
    category: 'Forecasting',
    definition:
      'A deep learning forecasting algorithm developed by Amazon. It learns demand patterns across multiple products simultaneously and can handle seasonality, trends, and external influences. Optima uses it as the core prediction engine.',
    usedIn: ['Data & Training'],
  },
  {
    term: 'Hybrid Model',
    category: 'Forecasting',
    definition:
      'Optima\'s forecasting approach combines DeepAR (deep learning) with STL decomposition and statistical error correction to produce more robust predictions than any single method alone.',
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
    term: 'Stagnant Trend',
    plain: 'Zombie Product',
    category: 'Forecasting',
    definition:
      'A product flagged as "stagnant" or "zombie" has flat or near-zero demand — it is neither growing nor declining meaningfully. These products may be candidates for clearance, discontinuation, or bundling to stimulate sales.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Model Health',
    category: 'Forecasting',
    definition:
      'An overall classification of how well a product\'s demand is behaving. HEALTHY means the model detected a meaningful trend or seasonal pattern and the forecast is reliable. STAGNANT (also called Zombie) means the product has near-zero or flat demand with no clear direction — forecasts for these items are less reliable and the product may need intervention.',
    example: 'A product consistently selling 0–2 units per month with no seasonal pattern would be flagged STAGNANT.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Healthy Trend',
    category: 'Forecasting',
    definition:
      'A product flagged as "HEALTHY" has a detected meaningful trend or seasonal pattern. Forecasts for these items are generally reliable and the model has successfully identified the demand signal.',
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
    term: 'Delta Variance',
    plain: 'Year-over-Year Change',
    category: 'Forecasting',
    definition:
      'The percentage and absolute unit difference between the current forecast and the historical benchmark for the same period. A positive delta means demand is expected to grow; negative means it is expected to fall.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Forecast Alignment',
    category: 'Forecasting',
    definition:
      'A score that measures how well the predicted future demand for a product matches the direction and magnitude of its historical trend. Higher alignment means the forecast is consistent with observed patterns.',
    usedIn: ['Bundle Analysis', 'Forecasting'],
  },
  {
    term: 'Trend Momentum',
    category: 'Forecasting',
    definition:
      'The rate at which a product\'s sales trend is accelerating or decelerating. Positive momentum means demand is growing faster over time; negative momentum means growth is slowing or reversing.',
    usedIn: ['Bundle Analysis', 'Forecasting'],
  },
  {
    term: 'Seasonal Weight',
    category: 'Forecasting',
    definition:
      'A measure of how much of a product\'s demand variability is explained by repeating seasonal patterns (e.g., holidays, back-to-school periods). A high seasonal weight means the product\'s sales are heavily influenced by the time of year.',
    usedIn: ['Bundle Analysis', 'Forecasting'],
  },

  // ─── BUNDLE ANALYSIS ──────────────────────────────────────────────────────

  {
    term: 'Lift',
    plain: 'Purchase Link Strength',
    category: 'Bundle Analysis',
    definition:
      'Measures how much more likely two products are to be purchased together compared to if customers chose randomly. A Lift above 1.0 indicates a real positive relationship between the items.',
    example: 'A Lift of 2.5x means customers are 2.5 times more likely to buy both items together than if the products were unrelated.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Confidence',
    plain: 'Rule Reliability',
    category: 'Bundle Analysis',
    definition:
      'In the context of bundle analysis: the percentage of transactions containing Product A that also contain Product B. High confidence means the pairing rule is consistently true in the historical data.',
    example: 'A Confidence of 72% means that in 72 out of 100 transactions where Product A was purchased, Product B was also purchased.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Support',
    plain: 'Pairing Frequency',
    category: 'Bundle Analysis',
    definition:
      'The percentage of all transactions that contain both products together. Support tells you how common a pairing is — low support means the pair appears rarely, even if it has high lift.',
    example: 'A Support of 3.5% means the pair appears together in 3.5% of all recorded transactions.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'Apriori Algorithm',
    plain: 'Pattern Mining Engine',
    category: 'Bundle Analysis',
    definition:
      'A classic data mining algorithm used to find frequent item co-occurrences in transaction data. Optima uses Apriori to scan sales history and identify which products are commonly bought together, forming the basis for bundle recommendations.',
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
    term: 'Product Pairing Insights',
    plain: 'Product Pairing Insights',
    category: 'Navigation',
    definition:
      'The view in the Product Bundler that displays all recommended product pairings from a saved bundling run. Each entry shows the pair, its statistical scores (Lift, Confidence, Support), and its strategic badge.',
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
    term: 'Strategic Badge',
    plain: 'Bundle Category',
    category: 'Bundle Analysis',
    definition:
      'A label assigned to each product pair by the scoring model, reflecting its overall opportunity type: STRATEGIC (consistently strong performers), EMERGING (growing potential), SEASONAL (time-dependent), or RISK (unlikely to succeed).',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'STRATEGIC',
    plain: 'High-Confidence Bundle',
    category: 'Bundle Analysis',
    definition:
      'A bundle badge indicating the product pair has strong, consistent historical co-purchase patterns and good forecast alignment. These are the highest-confidence recommendations for promotions or shelf placement.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'EMERGING',
    plain: 'Growing Opportunity',
    category: 'Bundle Analysis',
    definition:
      'A bundle badge indicating the product pair shows a rising co-purchase trend. Not yet as established as STRATEGIC bundles, but gaining momentum and worth watching or promoting.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'SEASONAL',
    plain: 'Time-Dependent Bundle',
    category: 'Bundle Analysis',
    definition:
      'A bundle badge indicating the product pair\'s co-purchase frequency is driven by specific seasons or time periods. Effective for promotions timed to those periods, but less reliable year-round.',
    usedIn: ['Bundle Analysis'],
  },
  {
    term: 'RISK',
    plain: 'Low-Confidence Bundle',
    category: 'Bundle Analysis',
    definition:
      'A bundle badge indicating the product pair has weak historical support, low confidence, or poor forecast alignment. Promoting this pair may not yield results and should be reviewed carefully before acting.',
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
    plain: 'Running the AI',
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
      'The AI model that analyzes your transaction history to generate 12-month demand predictions for each product. It uses a hybrid of deep learning and statistical decomposition to identify trends and seasonality.',
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
    term: 'Seasonality',
    category: 'Statistics',
    definition:
      'Repeating patterns in demand that occur at the same time every year — such as higher sales before holidays or lower sales in off-peak months. The forecasting model captures and accounts for seasonality.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Trend',
    category: 'Statistics',
    definition:
      'The long-term direction of demand, independent of seasonal fluctuations. A product can have an upward trend (growing demand over years) even if it has seasonal dips each summer.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Remainder',
    plain: 'Noise / Unexplained Variation',
    category: 'Statistics',
    definition:
      'In STL decomposition, the remainder (or residual) is the part of a sales signal that cannot be explained by trend or seasonality. Large remainder values may indicate anomalies, one-off events, or data quality issues.',
    usedIn: ['Forecasting'],
  },
  {
    term: 'Observed',
    plain: 'Raw Sales Data',
    category: 'Statistics',
    definition:
      'In STL decomposition, the "observed" component is the original, unmodified sales values — before any trend or seasonal effects are removed.',
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
      'The section within the Management Hub where you configure and launch AI model training. You select datasets, choose which models to run (Forecaster, Bundler, or both), and name the run.',
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
  return GLOSSARY.find(
    (entry) => entry.term.toLowerCase() === termName.toLowerCase()
  ) || null;
}
