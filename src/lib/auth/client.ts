"use client";

import { useShooAuth } from "@shoojs/react";

export function useAuthToken() {
  const { identity, loading } = useShooAuth();
  return {
    token: identity?.token ?? null,
    userId: identity?.userId ?? null,
    loading,
  };
}

export function authHeaders(token: string | null): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
