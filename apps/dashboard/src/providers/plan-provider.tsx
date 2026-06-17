'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchPlanStatus, type PlanStatus } from '@/lib/billingApi';

const CACHE_KEY = 'matumailer_plan_status_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedPlan = PlanStatus & { cachedAt: number };

function readCachedPlan(): PlanStatus | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPlan;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    const { cachedAt: _, ...plan } = parsed;
    return plan;
  } catch {
    return null;
  }
}

function writeCachedPlan(plan: PlanStatus) {
  try {
    const payload: CachedPlan = { ...plan, cachedAt: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

type PlanContextValue = {
  plan: PlanStatus | null;
  loading: boolean;
  isPremium: boolean;
  refresh: () => Promise<void>;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanStatus | null>(() => readCachedPlan());
  const [loading, setLoading] = useState(() => !readCachedPlan());

  const refresh = useCallback(async () => {
    try {
      const status = await fetchPlanStatus();
      setPlan(status);
      writeCachedPlan(status);
    } catch {
      /* keep cached / prior plan on transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      plan,
      loading,
      isPremium: plan?.tier === 'premium',
      refresh,
    }),
    [plan, loading, refresh],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error('usePlan debe usarse dentro de PlanProvider');
  }
  return ctx;
}
