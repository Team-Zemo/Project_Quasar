import { useState, useEffect } from 'react';
import { authState, refreshSession, type User } from '../lib/auth';

// Module-level flag to prevent StrictMode double-firing the refresh call
let refreshAttempted = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(authState.getUser());
  const [loading, setLoading] = useState(!refreshAttempted);

  useEffect(() => {
    const unsubscribe = authState.subscribe(setUser);

    // On app load, silently call /auth/refresh to restore session
    // Only do this once — StrictMode in dev calls effects twice
    if (!refreshAttempted && !authState.getUser()) {
      refreshAttempted = true;
      refreshSession().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return unsubscribe;
  }, []);

  const isAuthenticated = !!user;

  return { user, loading, isAuthenticated };
}
