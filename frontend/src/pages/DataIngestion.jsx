import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react';

export default function DataIngestion() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); 
  const [uploadMessage, setUploadMessage] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadStatus('loading');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/api/upload-data', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus('success');
      setUploadMessage(`Success! Cleaned ${response.data.total_rows_processed} rows. Ready for analysis.`);
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
      setUploadMessage('Failed to upload data. Is the FastAPI server running?');
    }
  };

  return (
    <div className="animate-fade-in-up max-w-4xl">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Database className="text-indigo-600" size={32} />
          Data Ingestion Pipeline
        </h2>
        <p className="text-gray-500 mt-2">Upload raw client sales data (.xlsx or .csv) to be cleaned and standardized by Module 1.</p>
      </div>

      {/* UPLOAD CARD */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-gray-800">
          <UploadCloud className="text-indigo-500" /> 
          Secure File Upload
        </h3>
        
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
          
          <input 
            type="file" 
            accept=".csv, .xlsx" 
            onChange={handleFileChange}
            className="mb-6 text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
          />
          
          <button 
            onClick={handleUpload}
            disabled={!file || uploadStatus === 'loading'}
            className="bg-gray-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-all w-full max-w-md justify-center shadow-md"
          >
            {uploadStatus === 'loading' ? <Loader2 className="animate-spin w-5 h-5" /> : 'Execute Data Cleaning'}
          </button>

          {/* Status Messages */}
          {uploadStatus === 'success' && (
            <div className="mt-6 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-6 py-3 rounded-lg w-full max-w-md justify-center font-medium">
              <CheckCircle className="w-5 h-5" />
              <span>{uploadMessage}</span>
            </div>
          )}
          
          {uploadStatus === 'error' && (
            <div className="mt-6 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-6 py-3 rounded-lg w-full max-w-md justify-center font-medium">
              <AlertCircle className="w-5 h-5" />
              <span>{uploadMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}