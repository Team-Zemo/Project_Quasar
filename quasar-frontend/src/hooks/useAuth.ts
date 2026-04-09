import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { authState, type User } from '../lib/auth';

/**
 * useAuth — single hook that ALL components use to access auth state.
 *
 * Architecture:
 *   authState (singleton)  ──subscribes──▶  useAuth() instance 1
 *                          ──subscribes──▶  useAuth() instance 2
 *                          ──subscribes──▶  useAuth() instance N
 *
 * All instances share the exact same { user, ready } snapshot.
 * `authState.init()` is called once (idempotent) and flips `ready`
 * to true when the initial /auth/refresh completes or fails.
 */
export function useAuth() {
  // Subscribe to the shared auth state — all useAuth instances see the same snapshot
  const snapshot = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      return authState.subscribe(onStoreChange);
    }, []),
    () => authState.getSnapshot(),
    () => authState.getSnapshot(),
  );

  // Trigger initialization exactly once (idempotent)
  useEffect(() => {
    authState.init();
  }, []);

  return {
    user: snapshot.user,
    loading: !snapshot.ready,
    isAuthenticated: !!snapshot.user,
  };
}
