'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: GoogleUser | null;
  login: (email: string, name: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load existing session from localStorage if available
    const savedSession = localStorage.getItem('google_user_session');
    if (savedSession) {
      try {
        setUser(JSON.parse(savedSession));
      } catch (e) {
        console.error('Failed to parse saved user session:', e);
        localStorage.removeItem('google_user_session');
      }
    }
    setLoading(false);
  }, []);

  const login = (email: string, name: string) => {
    // Generate a clean, colorful initial avatar
    const initials = name ? name.charAt(0) : email.charAt(0).toUpperCase();
    const bgColors = ['f44336', '3f51b5', '4caf50', 'ff9800', '9c27b0', '009688'];
    // Simple deterministic color index based on email hash
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash % bgColors.length);
    const picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColors[colorIndex]}&color=fff&bold=true&size=128`;
    
    const newUser: GoogleUser = { email, name, picture };
    setUser(newUser);
    localStorage.setItem('google_user_session', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('google_user_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
