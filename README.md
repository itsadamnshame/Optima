# 🚀 Optima - Smart Merchandising Platform

A state-of-the-art merchandising platform that bridges the gap between raw sales data and strategic retail execution. Optima automates complex data analysis, forecast modeling, and promotional planning, enabling retailers to maximize sales and minimize waste.

## ✨ Key Features

### 1. 🔮 Sales Forecasting
- **Advanced Modeling**: Utilizes DeepAR (Deep Autoregressive Forecasting) for highly accurate time-series predictions.
- **Contextual Awareness**: Incorporates external factors like holidays, promotions, and local events into forecasts.
- **Leaderboard System**: Identifies top-performing and underperforming products to guide stocking decisions.

### 2. 🛒 Product Recommendation Engine
- **Association Rule Mining**: Leverages the Apriori algorithm to discover hidden relationships between products.
- **Strategic Bundling**: Suggests optimal product pairings for cross-selling and promotions.
- **Performance Categorization**:
    - **Velocity Multiplier**: Boosts sales of frequently co-purchased items.
    - **High-Affinity Pair**: Capitalizes on strong customer behavior patterns.
    - **Stock Clearout**: Helps move slow-moving inventory.

### 3. 📊 Interactive Analytics Dashboard
- **Visual Leaderboard**: Interactive charts for product performance tracking.
- **Playlist Management**: A dynamic "What-If" scenario planner to test promotional strategies before execution.
- **Detailed Analytics View**: Deep dive into specific products with historical trends and confidence intervals.

## 🛠️ Tech Stack

### Backend
- **Python 3.10+**
- **FastAPI**: High-performance web framework for building APIs.
- **Pandas & NumPy**: Data manipulation and numerical operations.
- **PyTorch**: Deep learning for forecasting.

### Frontend
- **React 18**
- **Redux Toolkit**: State management.
- **Material UI (MUI)**: Component library.
- **Recharts**: Charting and visualization.
- **Vite**: Build tool.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.10 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Optima
   ```

2. **Backend Setup**
   - Navigate to the backend directory:
     ```bash
     cd backend
     ```
   - Create a virtual environment:
     ```bash
     python -m venv venv
     venv\Scripts\activate  # Windows
     # source venv/bin/activate  # macOS/Linux
     ```
   - Install dependencies:
     ```bash
     pip install -r requirements.txt
     ```

3. **Frontend Setup**
   - Navigate to the frontend directory:
     ```bash
     cd ../frontend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```

### Running the Application

- Start the backend server:
  ```bash
  uvicorn main:app --reload
  ```

- Start the frontend development server:
  ```bash
  npm run dev
  ```

The application will be accessible at `http://localhost:5173`.