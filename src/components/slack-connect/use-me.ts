"use client";

import { useCallback, useEffect, useState } from "react";
import { getMe, ME_CHANGED_EVENT, type Me } from "./api";

export interface MeState {
  me: Me | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** The current visitor (Slack user + channel). Refreshes on sign-in/out anywhere on the page. */
export function useMe(): MeState {
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getMe()
      .then((m) => {
        setMe(m);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your account"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(ME_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ME_CHANGED_EVENT, refresh);
  }, [refresh]);

  return { me, isLoading, error, refresh };
}
