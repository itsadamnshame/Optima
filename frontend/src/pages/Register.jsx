import React, { useState, useEffect } from 'react';
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

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must include one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must include one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include one number.';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Password must include one special character.';
    return '';
  };
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const [usernameDirty, setUsernameDirty] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle, checking, taken, available

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone_number') {
      setFormData({ ...formData, [name]: formatPhoneNumber(value) });
    } else if (name === 'username') {
      setUsernameDirty(true);
      setFormData({ ...formData, [name]: value });
      checkUsername(value);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const checkUsername = async (username) => {
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.exists) setUsernameStatus('taken');
      else setUsernameStatus('available');
    } catch {
      setUsernameStatus('idle');
    }
  };

  // Auto-generate username if not dirty
  useEffect(() => {
    if (!usernameDirty && (formData.first_name || formData.last_name)) {
      const suggested = `${formData.first_name}${formData.last_name ? '-' + formData.last_name : ''}`.replace(/\s+/g, '');
      if (suggested) {
        setFormData(prev => ({ ...prev, username: suggested }));
        checkUsername(suggested);
      }
    }
  }, [formData.first_name, formData.last_name]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
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
          <div className="p-2 rounded-lg text-white shadow-lg" style={{ background: 'var(--accent)', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}>
            <Zap size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic" style={{ color: 'var(--text-heading)' }}>OPTIMA</h1>
        </div>
        
        <h2 className="text-xl font-bold text-center mb-6" style={{ color: 'var(--text-primary)' }}>Create an Account</h2>
        
        {success && (
          <div className="p-4 rounded-lg mb-4 text-sm font-medium text-center" style={{ background: 'var(--success-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}>
            Account created successfully!<br/><br/>
            Your account is currently <span className="font-bold">Under Review</span>. An Administrator must approve it before you can log in.
            <br/><br/>
            <Link to="/login" className="underline font-bold transition-opacity hover:opacity-70" style={{ color: 'var(--accent)' }}>Return to Login</Link>
          </div>
        )}
        
        {!success && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>First Name</label>
                <input 
                  type="text" 
                  name="first_name"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Middle Name</label>
                <input 
                  type="text" 
                  name="middle_name"
                  placeholder="(Optional)"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                  value={formData.middle_name}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Last Name</label>
                <input 
                  type="text" 
                  name="last_name"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
                <input 
                  type="tel" 
                  name="phone_number"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                  value={formData.phone_number}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Username</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="username"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all pr-10"
                  style={{ 
                    background: 'var(--input-bg)', 
                    border: usernameStatus === 'taken' ? '1px solid var(--error-border)' : '1px solid var(--input-border)', 
                    color: 'var(--input-text)' 
                  }}
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                  {usernameStatus === 'available' && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--success-glow)]" />}
                  {usernameStatus === 'taken' && <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />}
                </div>
              </div>
              {usernameStatus === 'taken' && <p className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: '#f43f5e' }}>Username is already taken</p>}
              {usernameStatus === 'available' && <p className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: '#10b981' }}>Username is available</p>}
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button 
                  type="button" 
                  className="absolute right-3 top-3 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Repeat Password</label>
              <input 
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>Password must be 8+ characters and include uppercase, lowercase, number, and special symbol.</p>
            </div>

            <div className="flex items-start gap-3 mt-6">
              <input 
                type="checkbox" 
                id="terms"
                className="mt-1 h-4 w-4 rounded cursor-pointer"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
              />
              <label htmlFor="terms" className="text-sm leading-tight" style={{ color: 'var(--text-muted)' }}>
                I accept the <button type="button" onClick={() => setShowTermsModal(true)} className="font-bold hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>Terms and Conditions</button> and consent to the processing of my personal data.
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-xs font-black uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-1" 
                style={{ background: 'var(--error-bg)', color: 'var(--sim-error-text)', border: '1px solid var(--error-border)', marginTop: '24px' }}>
                {error}
              </div>
            )}

            <button type="submit" className="w-full text-white font-bold py-3 rounded-lg transition-all mt-4 shadow-lg"
              style={{ background: 'var(--accent)', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}>
              Register
            </button>
          </form>
        )}
        
        {!success && (
          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Already have an account? <Link to="/login" className="font-bold hover:opacity-80 transition-opacity" style={{ color: 'var(--accent)' }}>Log in</Link>
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
