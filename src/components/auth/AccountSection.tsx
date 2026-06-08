"use client";

import { useShooAuth } from "@shoojs/react";

export function AccountSection() {
  const { identity, claims, loading, signIn, clearIdentity } = useShooAuth();

  if (loading) {
    return (
      <div className="flex h-9 items-center px-1">
        <span className="text-xs text-stone-500">Loading…</span>
      </div>
    );
  }

  if (!identity?.userId) {
    return (
      <button
        onClick={() => signIn()}
        className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
        type="button"
      >
        Sign in
      </button>
    );
  }

  const displayName = claims?.name || identity.userId;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{displayName}</p>
      </div>
      <button
        onClick={() => clearIdentity()}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200"
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
