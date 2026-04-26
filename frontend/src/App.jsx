import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Database, BarChart2, Lightbulb, Zap } from 'lucide-react';

import DataIngestion from './pages/DataIngestion';
import Analytics from './pages/Analytics';
import Playbook from './pages/Playbook';

// Helper component for navigation styling
function NavLink({ to, icon: Icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors font-medium ${
        isActive 
          ? 'bg-indigo-600 text-white shadow-md' 
          : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      <Icon size={20} />
      {children}
    </Link>
  );
}

function App() {
  // --- GLOBAL PERSISTENCE STATES ---
  const [recommendations, setRecommendations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Forecast Persistence (Module 2)
  const [persistedChart, setPersistedChart] = useState([]);
  const [persistedMetrics, setPersistedMetrics] = useState({});
  const [lastForecastTime, setLastForecastTime] = useState(null);

  // Helper to check if data is still valid (10-minute rule)
  const getValidData = (data, fallback) => {
    if (!lastForecastTime) return fallback;
    const now = new Date().getTime();
    const tenMinutes = 10 * 60 * 1000;
    
    if (now - lastForecastTime > tenMinutes) {
      return fallback; // Data expired
    }
    return data;
  };

  return (
    <Router>
      <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 flex items-center gap-3 border-b border-gray-100">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Zap size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">OPTIMA</h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 mt-2">Modules</p>
            <NavLink to="/" icon={Database}>1. Data Ingestion</NavLink>
            <NavLink to="/analytics" icon={BarChart2}>2. Quantitative</NavLink>
            <NavLink to="/playbook" icon={Lightbulb}>3. Strategic Playbook</NavLink>
          </nav>
          
          <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
            Thesis Prototype v1.0
          </div>
        </aside>

        {/* MAIN PAGE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<DataIngestion />} />
            
            <Route 
              path="/analytics" 
              element={
                <Analytics 
                  // Setters to save data to global state
                  setGlobalRecommendations={setRecommendations} 
                  setGlobalLoading={setIsGenerating}
                  setPersistedChart={setPersistedChart}
                  setPersistedMetrics={setPersistedMetrics}
                  setLastForecastTime={setLastForecastTime}
                  
                  // Getters to retrieve existing data
                  existingChart={getValidData(persistedChart, [])}
                  existingMetrics={getValidData(persistedMetrics, {})}
                />
              } 
            />
            
            <Route 
              path="/playbook" 
              element={
                <Playbook 
                  recommendations={getValidData(recommendations, [])} 
                  isGenerating={isGenerating} 
                />
              } 
            />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;