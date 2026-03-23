import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Session = {
  token: string;
  email: string;
};

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('admin_session');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Session;
        if (parsed && parsed.token) setSession(parsed);
      } catch {
        localStorage.removeItem('admin_session');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await fetch('/api/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; email?: string; error?: string };
    if (!res.ok || data.ok !== true || !data.token) throw new Error(data.error || 'Login failed');
    const next: Session = { token: data.token, email: data.email || email || 'admin' };
    localStorage.setItem('admin_session', JSON.stringify(next));
    setSession(next);
  };

  const signOut = async () => {
    localStorage.removeItem('admin_session');
    setSession(null);
  };

  const getAuthHeader = useMemo(() => {
    return () => (session?.token ? { Authorization: `Bearer ${session.token}` } : {});
  }, [session?.token]);

  const value: AuthContextType = { session, loading, signIn, signOut, getAuthHeader };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
