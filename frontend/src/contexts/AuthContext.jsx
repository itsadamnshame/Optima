import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [role, setRole] = useState(localStorage.getItem('role') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || null);
  const [sessionId, setSessionId] = useState(localStorage.getItem('session_id') || null);
  const pollRef = useRef(null);

  const login = (newToken, newRole, newUsername, newSessionId) => {
    setToken(newToken);
    setRole(newRole);
    setUsername(newUsername);
    setSessionId(newSessionId || null);
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', newRole);
    localStorage.setItem('username', newUsername);
    if (newSessionId) localStorage.setItem('session_id', newSessionId);
  };

  const clearSession = useCallback(() => {
    setToken(null);
    setRole(null);
    setUsername(null);
    setSessionId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('session_id');
  }, []);

  const logout = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
      } catch (e) { /* silently fail */ }
    }
    clearSession();
  }, [clearSession]);

  // Poll session status every 30 seconds when logged in
  useEffect(() => {
    if (!token) {
      clearInterval(pollRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/session-status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'terminated') {
          clearSession();
          window.location.href = '/login';
          return;
        }
      } catch (e) { /* network issue — do nothing */ }
    };

    checkStatus(); // run immediately on login
    pollRef.current = setInterval(checkStatus, 30000); // then every 30s

    return () => clearInterval(pollRef.current);
  }, [token, clearSession]);

  // Inactivity timeout (1 hour)
  useEffect(() => {
    let timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (token) {
          logout();
          window.location.href = '/login';
        }
      }, 3600000);
    };

    if (token) {
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('scroll', resetTimer);
      window.addEventListener('click', resetTimer);
      resetTimer();
    }

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, role, username, sessionId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
