import React, { useState } from 'react';
import axios from 'axios';
import { BarChart2, Loader2, Activity, Target, Database, AlertTriangle, Calendar } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';

export default function Analytics() {
  const [chartData, setChartData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Fetch the data from the Python backend
  const runQuantitativeAnalysis = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      const response = await axios.get('http://localhost:8000/api/generate-recommendations');
      setChartData(response.data.chart_data);
      setMetrics(response.data.model_metrics);
    } catch (err) {
      console.error(err);
      setError("Error running analysis. Did you upload the data on the Ingestion page first?");
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to isolate the top item for the graph
  const topItemName = chartData.length > 0 ? chartData[0].item_description : '';
  const graphData = chartData.filter(d => d.item_description === topItemName);

  // RESTORED: Calculate volume metrics
  const totalProjected = graphData.reduce((sum, item) => sum + item.predicted_quantity, 0);
  const highestWeek = graphData.length > 0 ? Math.max(...graphData.map(d => d.predicted_quantity)) : 0;

  return (
    <div className="animate-fade-in-up">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BarChart2 className="text-indigo-600" size={32} />
          Quantitative Analysis
        </h2>
        <p className="text-gray-500 mt-2">Time-series forecasting, confidence intervals, and multi-metric error tracking.</p>
      </div>

      {/* CONTROL PANEL */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-800">Prophet Forecasting Engine</h3>
          <p className="text-sm text-gray-500">Run the model to project 4-week future sales volume.</p>
        </div>
        <button 
          onClick={runQuantitativeAnalysis}
          disabled={isGenerating}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
        >
          {isGenerating ? <><Loader2 className="animate-spin w-5 h-5" /> Processing...</> : 'Execute Forecast'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      {/* DASHBOARD CONTENT */}
      {chartData.length > 0 && (
        <div className="space-y-8">
          
          {/* MULTI-METRIC ROW (Now 6 Boxes in a 3x2 Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Box 1: Projected Volume */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg"><Activity className="text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Projected Volume (4W)</p>
                <p className="text-2xl font-bold text-gray-900">{totalProjected} Units</p>
              </div>
            </div>
            
            {/* Box 2: Peak Weekly Sale */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg"><Calendar className="text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Peak Weekly Sale</p>
                <p className="text-2xl font-bold text-gray-900">{highestWeek} Units</p>
              </div>
            </div>

            {/* Box 3: Algorithm Info */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-lg"><Database className="text-amber-600" /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Algorithm</p>
                <p className="text-lg font-bold text-gray-900">FB Prophet</p>
              </div>
            </div>
            
            {/* Box 4: WAPE */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg"><Target className="text-purple-600" /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Retail Error (WAPE)</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.WAPE}%</p>
                <p className="text-xs text-gray-400">Volume-weighted</p>
              </div>
            </div>

            {/* Box 5: MAE */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-lg"><Activity className="text-indigo-600" /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Avg. Unit Miss (MAE)</p>
                <p className="text-2xl font-bold text-gray-900">±{metrics?.MAE}</p>
                <p className="text-xs text-gray-400">Units per week</p>
              </div>
            </div>

            {/* Box 6: MAPE (With Warning) */}
            <div className={`p-5 rounded-xl shadow-sm flex flex-col justify-center ${metrics?.mape_warning ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-gray-200'}`}>
              <p className="text-sm text-gray-500 font-medium mb-1">Standard Error (MAPE)</p>
              {metrics?.mape_warning ? (
                <div>
                  <p className="text-lg font-bold text-amber-700">{metrics.MAPE}</p>
                  <p className="text-[10px] leading-tight text-amber-600 mt-1 flex items-start gap-1">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" /> 
                    Incompatible with intermittent datasets.
                  </p>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{metrics?.MAPE}</p>
              )}
            </div>

          </div>

          {/* MASSIVE INTERACTIVE CHART */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Trend Projection: {topItemName}</h3>
            <p className="text-sm text-gray-500 mb-8">Shaded blue area represents the 80% confidence interval computed by Prophet.</p>
            
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={graphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="forecast_date" tick={{fontSize: 12, fill: '#6b7280'}} tickMargin={10} />
                  <YAxis tick={{fontSize: 12, fill: '#6b7280'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                  
                  <Area type="monotone" dataKey="best_case_quantity" name="Best Case (+)" fill="#e0e7ff" stroke="none" />
                  <Area type="monotone" dataKey="worst_case_quantity" name="Worst Case (-)" fill="#ffffff" stroke="none" />
                  <Line type="monotone" dataKey="predicted_quantity" name="Target Prediction" stroke="#4f46e5" strokeWidth={3} dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RAW DATA TABLE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-800">Raw Projection Data</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Week Of</th>
                    <th className="px-6 py-3">Worst Case (Lower Bound)</th>
                    <th className="px-6 py-3 text-indigo-600">Predicted Volume</th>
                    <th className="px-6 py-3">Best Case (Upper Bound)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {graphData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.forecast_date}</td>
                      <td className="px-6 py-4 text-gray-500">{row.worst_case_quantity} units</td>
                      <td className="px-6 py-4 text-indigo-600 font-bold">{row.predicted_quantity} units</td>
                      <td className="px-6 py-4 text-gray-500">{row.best_case_quantity} units</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}