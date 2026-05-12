import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) { login(data.token, data.role, data.username, data.session_id, data.first_name, data.last_name); navigate('/'); }
      else setError(data.detail || 'Login failed');
    } catch { setError('Network error'); }
  };

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--input-text)',
  };

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient glow */}
      <div className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'var(--accent-glow)', top: '20%', left: '50%', transform: 'translateX(-50%)' }} />

      <div className="relative z-10 w-full max-w-sm p-8 rounded-[2rem]" style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)`, backdropFilter: 'blur(12px)' }}>
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30 glow-pulse">
            <Zap size={22} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter italic">OPTIMA</h1>
        </div>

        <h2 className="text-lg font-bold text-zinc-200 text-center mb-6">Welcome Back</h2>

        {error && (
          <div className="p-3 rounded-xl mb-4 text-sm font-medium text-rose-300" style={{ background: 'var(--error-bg)', border: `1px solid var(--error-border)` }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Username</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl outline-none font-medium text-sm transition-all focus:ring-2 focus:ring-indigo-500/50"
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-4 py-3 rounded-xl outline-none font-medium text-sm transition-all focus:ring-2 focus:ring-indigo-500/50"
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="absolute right-3 top-3 text-zinc-600 hover:text-zinc-300 transition-colors" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit"
            className="w-full font-black py-3 rounded-xl transition-all mt-2 text-white text-sm"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)', boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}>
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
