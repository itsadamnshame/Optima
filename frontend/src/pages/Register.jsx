import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    phone_number: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    if (!acceptTerms) {
      setError("You must accept the Terms and Conditions.");
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: formData.username, 
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          middle_name: formData.middle_name,
          email: formData.email,
          phone_number: formData.phone_number
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center font-sans py-12" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md p-8 rounded-xl" style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-200 shadow-lg">
            <Zap size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic" style={{ color: 'var(--text-heading)' }}>OPTIMA</h1>
        </div>
        
        <h2 className="text-xl font-bold text-center mb-6" style={{ color: 'var(--text-primary)' }}>Create an Account</h2>
        
        {error && <div className="p-3 rounded-lg mb-4 text-sm font-medium" style={{ background: 'var(--error-bg)', color: 'var(--sim-error-text)' }}>{error}</div>}
        {success && (
          <div className="p-4 rounded-lg mb-4 text-sm font-medium text-center" style={{ background: 'var(--success-bg)', color: '#059669' }}>
            Account created successfully!<br/><br/>
            Your account is currently <span className="font-bold">Under Review</span>. An Administrator must approve it before you can log in.
            <br/><br/>
            <Link to="/login" className="underline font-bold hover:text-green-900">Return to Login</Link>
          </div>
        )}
        
        {!success && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">First Name</label>
                <input 
                  type="text" 
                  name="first_name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Middle Name</label>
                <input 
                  type="text" 
                  name="middle_name"
                  placeholder="(Optional)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.middle_name}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Last Name</label>
                <input 
                  type="text" 
                  name="last_name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                <input 
                  type="tel" 
                  name="phone_number"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.phone_number}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
              <input 
                type="text" 
                name="username"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button 
                  type="button" 
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Repeat Password</label>
              <input 
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <div className="flex items-start gap-3 mt-6">
              <input 
                type="checkbox" 
                id="terms"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-600 leading-tight">
                I accept the <button type="button" onClick={() => setShowTermsModal(true)} className="text-indigo-600 font-bold hover:underline">Terms and Conditions</button> and consent to the processing of my personal data.
              </label>
            </div>

            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors mt-6">
              Register
            </button>
          </form>
        )}
        
        {!success && (
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Log in</Link>
          </p>
        )}
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-900">Terms and Conditions</h3>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-gray-600 text-sm space-y-4">
              <p><strong>1. Acceptance of Terms</strong><br/>By registering for the Optima Platform, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the platform.</p>
              
              <p><strong>2. Data Privacy and Security</strong><br/>We are committed to protecting your privacy. Any personal information provided during registration (including your name, email, and phone number) will be securely stored and only used for authentication and authorization purposes within the Optima system.</p>
              
              <p><strong>3. Admin Approval Workflow</strong><br/>Creating an account does not grant immediate access to the system. All accounts are placed in an "Under Review" status upon creation. System Administrators hold the right to approve or deny access based on internal organizational policies.</p>
              
              <p><strong>4. User Responsibilities</strong><br/>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify administrators immediately of any unauthorized use of your account. The platform features an automatic 1-hour inactivity timeout to protect your session.</p>
              
              <p><strong>5. System Usage</strong><br/>The Optima Platform is an academic prototype designed for enterprise forecasting and qualitative bundling analysis. You agree not to misuse the analytical tools, attempt to bypass security protocols, or upload malicious datasets.</p>
              
              <p><strong>6. Modifications to Terms</strong><br/>We reserve the right to update these terms at any time. Continued use of the platform following any modifications indicates your acceptance of the updated terms.</p>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button 
                onClick={() => setShowTermsModal(false)}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setAcceptTerms(true);
                  setShowTermsModal(false);
                }}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
